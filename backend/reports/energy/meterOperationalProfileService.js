const EnergyMeterLog = require('../../models/EnergyMeterLog');
const { buildLogFilterForMeters } = require('../../utils/energyMeterUtils');
const {
  roundTo,
  istStartUtcFromYMD,
  getISTDateComponentsFromUtcDate,
  VOLTAGE_BAND,
  PF_DRILLDOWN_BANDS,
} = require('../../utils/meterInsightsUtils');

const IST_TZ = 'Asia/Kolkata';
const NOMINAL_VOLTAGE = 230;
const NOMINAL_SAMPLE_INTERVAL_MS = 5 * 60 * 1000;
const HEALTH_TREND_DELTA = 3;

function resolveBucketMode(reportType) {
  return reportType === 'yearly' ? 'month' : 'day';
}

function formatBucketLabel(bucket, bucketMode) {
  if (!bucket) return '—';
  if (bucketMode === 'month') {
    const d = new Date(`${bucket}-01T00:00:00+05:30`);
    return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: IST_TZ });
  }
  const d = new Date(`${bucket}T00:00:00+05:30`);
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: IST_TZ });
}

function formatBucketKey(date, bucketMode) {
  const parts = getISTDateComponentsFromUtcDate(date);
  const y = String(parts.year);
  const m = String(parts.month + 1).padStart(2, '0');
  if (bucketMode === 'month') return `${y}-${m}`;
  const d = String(parts.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addMonth(date) {
  const parts = getISTDateComponentsFromUtcDate(date);
  return istStartUtcFromYMD(parts.month === 11 ? parts.year + 1 : parts.year, (parts.month + 1) % 12, 1);
}

function buildBuckets(period, bucketMode) {
  const buckets = [];
  let cursor = bucketMode === 'month'
    ? istStartUtcFromYMD(getISTDateComponentsFromUtcDate(period.from).year, getISTDateComponentsFromUtcDate(period.from).month, 1)
    : istStartUtcFromYMD(
      getISTDateComponentsFromUtcDate(period.from).year,
      getISTDateComponentsFromUtcDate(period.from).month,
      getISTDateComponentsFromUtcDate(period.from).day
    );

  while (cursor <= period.to) {
    const key = formatBucketKey(cursor, bucketMode);
    const next = bucketMode === 'month'
      ? addMonth(cursor)
      : new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    const from = new Date(Math.max(cursor.getTime(), period.from.getTime()));
    const to = new Date(Math.min(next.getTime() - 1, period.to.getTime()));
    buckets.push({
      key,
      label: formatBucketLabel(key, bucketMode),
      from,
      to,
      expectedSamples: Math.max(1, Math.ceil((to.getTime() - from.getTime() + 1) / NOMINAL_SAMPLE_INTERVAL_MS)),
    });
    cursor = next;
  }
  return buckets;
}

function scorePowerFactor(avgPf) {
  if (avgPf == null) return null;
  if (avgPf >= PF_DRILLDOWN_BANDS.healthy) return 95;
  if (avgPf >= PF_DRILLDOWN_BANDS.warning) return 75;
  if (avgPf >= 0.8) return 55;
  return 30;
}

function scoreVoltage(avgVoltage, minVoltage, maxVoltage) {
  if (avgVoltage == null) return null;
  const deviation = Math.abs(avgVoltage - NOMINAL_VOLTAGE);
  let score = 100 - deviation * 2;
  if (minVoltage != null && minVoltage < VOLTAGE_BAND.lower) score -= 15;
  if (maxVoltage != null && maxVoltage > VOLTAGE_BAND.upper) score -= 15;
  return Math.max(0, Math.min(100, score));
}

function scoreAlarms(alarmCounts) {
  const critical = alarmCounts?.critical || 0;
  const warning = alarmCounts?.warning || 0;
  const penalty = critical * 30 + warning * 12;
  return Math.max(0, 100 - penalty);
}

function scoreCoverage(sampleCount, expectedSamples) {
  if (!expectedSamples) return null;
  return Math.max(0, Math.min(100, (sampleCount / expectedSamples) * 100));
}

function weightedScore(factors) {
  const valid = factors.filter((f) => f.score != null && Number.isFinite(f.score));
  const totalWeight = valid.reduce((sum, f) => sum + f.weight, 0);
  if (!valid.length || totalWeight <= 0) return null;
  return Math.round(valid.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight);
}

function deriveHealthScore(row, expectedSamples) {
  if (!row.sampleCount) return null;
  return weightedScore([
    { score: scorePowerFactor(row.avgPowerFactor), weight: 0.35 },
    { score: scoreVoltage(row.avgVoltage, row.minVoltage, row.maxVoltage), weight: 0.30 },
    { score: scoreAlarms(row.alarms), weight: 0.20 },
    { score: scoreCoverage(row.sampleCount, expectedSamples), weight: 0.15 },
  ]);
}

function deriveStatus(row) {
  if (!row.sampleCount) return 'No Data';
  if ((row.alarms?.critical || 0) > 0 || (row.healthScore != null && row.healthScore < 60)) return 'Critical';
  if ((row.alarms?.warning || 0) > 0 || (row.healthScore != null && row.healthScore < 80)) return 'Warning';
  return 'Healthy';
}

function avg(values) {
  const nums = values.filter((v) => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

function maxBy(rows, valueKey) {
  const valid = rows.filter((r) => r[valueKey] != null && Number.isFinite(Number(r[valueKey])));
  if (!valid.length) return null;
  return valid.reduce((best, row) => (Number(row[valueKey]) > Number(best[valueKey]) ? row : best), valid[0]);
}

function minBy(rows, valueKey) {
  const valid = rows.filter((r) => r[valueKey] != null && Number.isFinite(Number(r[valueKey])));
  if (!valid.length) return null;
  return valid.reduce((best, row) => (Number(row[valueKey]) < Number(best[valueKey]) ? row : best), valid[0]);
}

function longestNoDataStreak(rows) {
  let best = null;
  let active = null;
  rows.forEach((row) => {
    if (row.sampleCount === 0) {
      active = active || { start: row.label, end: row.label, count: 0 };
      active.end = row.label;
      active.count += 1;
      if (!best || active.count > best.count) best = { ...active };
    } else {
      active = null;
    }
  });
  return best;
}

function deriveHealthTrend(rows) {
  const values = rows.map((r) => r.healthScore).filter((v) => v != null && Number.isFinite(v));
  if (values.length < 2) return '→ Stable';
  const split = Math.max(1, Math.floor(values.length / 2));
  const first = avg(values.slice(0, split));
  const second = avg(values.slice(split));
  const delta = (second ?? 0) - (first ?? 0);
  if (delta > HEALTH_TREND_DELTA) return '↑ Improving';
  if (delta < -HEALTH_TREND_DELTA) return '↓ Declining';
  return '→ Stable';
}

function buildPerformanceHighlights(rows) {
  const bestHealth = maxBy(rows, 'healthScore');
  const worstHealth = minBy(rows, 'healthScore');
  const highestEnergy = maxBy(rows, 'energyKwh');
  const highestPeak = maxBy(rows, 'peakPowerKw');
  const mostAlarms = rows.reduce((best, row) => ((row.alarms?.total || 0) > (best?.alarms?.total || 0) ? row : best), rows[0]);
  const noData = longestNoDataStreak(rows);

  return {
    bestHealth: bestHealth ? { label: bestHealth.label, value: `${bestHealth.healthScore}/100` } : null,
    worstHealth: worstHealth ? { label: worstHealth.label, value: `${worstHealth.healthScore}/100` } : null,
    highestConsumption: highestEnergy ? { label: highestEnergy.label, value: `${highestEnergy.energyKwh ?? 0} kWh` } : null,
    highestPeakLoad: highestPeak ? { label: highestPeak.label, value: `${highestPeak.peakPowerKw ?? 0} kW` } : null,
    mostAlarms: mostAlarms ? { label: mostAlarms.label, value: `${mostAlarms.alarms?.total || 0} alarms` } : null,
    longestNoData: noData ? { label: noData.start === noData.end ? noData.start : `${noData.start} - ${noData.end}`, value: `${noData.count} bucket(s)` } : null,
  };
}

function buildSummary(rows) {
  const receivedSamples = rows.reduce((sum, r) => sum + (r.sampleCount || 0), 0);
  const expectedSamples = rows.reduce((sum, r) => sum + (r.expectedSamples || 0), 0);
  const coveragePct = expectedSamples ? roundTo((receivedSamples / expectedSamples) * 100, 1) : null;
  const totalEnergyKwh = roundTo(rows.reduce((sum, r) => sum + (r.energyKwh || 0), 0), 2);
  const peakPowerKw = maxBy(rows, 'peakPowerKw')?.peakPowerKw ?? null;

  return {
    totalEnergyKwh,
    peakPowerKw,
    avgVoltage: roundTo(avg(rows.map((r) => r.avgVoltage)), 2),
    avgPowerFactor: roundTo(avg(rows.map((r) => r.avgPowerFactor)), 2),
    totalAlarms: rows.reduce((sum, r) => sum + (r.alarms?.total || 0), 0),
    overallHealth: Math.round(avg(rows.map((r) => r.healthScore)) || 0),
    receivedSamples,
    expectedSamples,
    dataCoveragePct: coveragePct,
    dataCoverageLabel: expectedSamples ? `${receivedSamples} / ${expectedSamples} (${coveragePct}%)` : 'N/A',
    healthTrend: deriveHealthTrend(rows),
  };
}

function formatAggNumber(value, decimals = 2) {
  return value == null || !Number.isFinite(Number(value)) ? null : roundTo(Number(value), decimals);
}

function mongoReadingExpr(readingKey, rawIndex, rawScale = 1) {
  return {
    $ifNull: [
      { $convert: { input: `$readings.${readingKey}`, to: 'double', onError: null, onNull: null } },
      {
        $let: {
          vars: { rawValue: { $arrayElemAt: ['$rawValues', rawIndex] } },
          in: {
            $cond: [
              { $ne: ['$$rawValue', null] },
              {
                $multiply: [
                  { $convert: { input: '$$rawValue', to: 'double', onError: null, onNull: null } },
                  rawScale,
                ],
              },
              null,
            ],
          },
        },
      },
    ],
  };
}

async function buildMeterOperationalProfiles({ meters, period, alarmBuckets = {}, meterRows = [] }) {
  const bucketMode = resolveBucketMode(period.reportType);
  const buckets = buildBuckets(period, bucketMode);
  const rowMetaByMeterId = {};
  meterRows.forEach((row) => {
    if (row?.meterId) rowMetaByMeterId[row.meterId] = row;
  });
  const metaByMeter = {};
  meters.forEach((m) => {
    const resolvedId = m.deviceId;
    const rowMeta = rowMetaByMeterId[resolvedId];
    metaByMeter[m.deviceId] = {
      meterId: resolvedId,
      siteName: rowMeta?.siteName || m.siteName || '',
      machineName: rowMeta?.machineName || m.machineName || resolvedId,
      online: rowMeta?.online ?? Boolean(m.online),
    };
  });

  if (!meters?.length) {
    return { bucketMode, buckets, meters: [] };
  }

  const logFilter = await buildLogFilterForMeters(meters, {
    timestamp: { $gte: period.from, $lte: period.to },
  });

  const rows = await EnergyMeterLog.aggregate([
    { $match: logFilter },
    { $sort: { meterId: 1, timestamp: 1 } },
    {
      $project: {
        meterId: 1,
        bucket: {
          $dateToString: {
            format: bucketMode === 'month' ? '%Y-%m' : '%Y-%m-%d',
            date: '$timestamp',
            timezone: IST_TZ,
          },
        },
        voltage: mongoReadingExpr('voltage', 0, 0.1),
        current: mongoReadingExpr('current', 1, 0.01),
        activePower: mongoReadingExpr('activePower', 2, 0.01),
        energy: mongoReadingExpr('energy', 3, 0.1),
        powerFactor: mongoReadingExpr('powerFactor', 4, 0.01),
        frequency: mongoReadingExpr('frequency', 5, 0.01),
      },
    },
    {
      $group: {
        _id: { meterId: '$meterId', bucket: '$bucket' },
        avgPower: { $avg: '$activePower' },
        peakPower: { $max: '$activePower' },
        minPower: { $min: '$activePower' },
        avgVoltage: { $avg: '$voltage' },
        minVoltage: { $min: '$voltage' },
        maxVoltage: { $max: '$voltage' },
        avgCurrent: { $avg: '$current' },
        avgPf: { $avg: '$powerFactor' },
        avgFreq: { $avg: '$frequency' },
        firstEnergy: { $first: '$energy' },
        lastEnergy: { $last: '$energy' },
        sampleCount: { $sum: 1 },
      },
    },
    { $sort: { '_id.meterId': 1, '_id.bucket': 1 } },
  ]).allowDiskUse(true);

  const byMeterBucket = {};
  rows.forEach((row) => {
    const meterId = row._id.meterId;
    const bucket = row._id.bucket;
    if (!byMeterBucket[meterId]) byMeterBucket[meterId] = {};
    byMeterBucket[meterId][bucket] = row;
  });

  const profiles = meters.map((meter) => {
    const meterId = meter.deviceId;
    const meta = metaByMeter[meterId] || { meterId, siteName: '', machineName: meterId, online: false };
    const bucketRows = buckets.map((bucket) => {
      const source = byMeterBucket[meterId]?.[bucket.key] || {};
      const alarms = alarmBuckets[meterId]?.[bucket.key] || { total: 0, critical: 0, warning: 0 };
      const firstEnergy = Number(source.firstEnergy);
      const lastEnergy = Number(source.lastEnergy);
      const energyKwh = Number.isFinite(firstEnergy) && Number.isFinite(lastEnergy)
        ? roundTo(Math.max(0, lastEnergy - firstEnergy), 2)
        : 0;
      const row = {
        bucket: bucket.key,
        label: bucket.label,
        expectedSamples: bucket.expectedSamples,
        sampleCount: source.sampleCount || 0,
        energyKwh,
        peakPowerKw: formatAggNumber(source.peakPower),
        avgPowerKw: formatAggNumber(source.avgPower),
        minPowerKw: formatAggNumber(source.minPower),
        avgVoltage: formatAggNumber(source.avgVoltage),
        minVoltage: formatAggNumber(source.minVoltage),
        maxVoltage: formatAggNumber(source.maxVoltage),
        avgCurrent: formatAggNumber(source.avgCurrent),
        avgPowerFactor: formatAggNumber(source.avgPf),
        avgFrequency: formatAggNumber(source.avgFreq),
        alarms,
      };
      row.healthScore = deriveHealthScore(row, bucket.expectedSamples);
      row.status = deriveStatus(row);
      return row;
    });

    return {
      ...meta,
      rows: bucketRows,
      summary: buildSummary(bucketRows),
      highlights: buildPerformanceHighlights(bucketRows),
    };
  });

  return { bucketMode, buckets, meters: profiles };
}

module.exports = {
  buildMeterOperationalProfiles,
  resolveBucketMode,
  buildBuckets,
};
