const EnergyMeterLog = require('../../models/EnergyMeterLog');
const { buildLogFilterForMeters } = require('../../utils/energyMeterUtils');
const { roundTo } = require('../../utils/meterInsightsUtils');

const IST_TZ = 'Asia/Kolkata';
const DEFAULT_OPERATING_THRESHOLD_PCT = 20;

function hourLabel(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function hourRangeLabel(hour) {
  const start = hourLabel(hour);
  const end = hourLabel((hour + 1) % 24);
  return `${start}-${end}`;
}

function avg(values) {
  const nums = values.filter((v) => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

function stdDev(values, mean) {
  const nums = values.filter((v) => v != null && Number.isFinite(v));
  if (!nums.length || mean == null) return null;
  const variance = nums.reduce((sum, v) => sum + ((v - mean) ** 2), 0) / nums.length;
  return Math.sqrt(variance);
}

function classifyLoadPattern(values, averageLoadKw, peakLoadKw, loadFactorPct) {
  const valid = values.filter((v) => v != null && Number.isFinite(v));
  if (!valid.length || !Number.isFinite(averageLoadKw) || !Number.isFinite(peakLoadKw) || peakLoadKw <= 0) {
    return 'Unavailable';
  }

  const baseLoadKw = Math.min(...valid);
  const variabilityRatio = (peakLoadKw - baseLoadKw) / peakLoadKw;
  const cov = (stdDev(valid, averageLoadKw) || 0) / averageLoadKw;

  if (loadFactorPct >= 75 && variabilityRatio <= 0.25 && cov <= 0.2) return 'Steady';
  if (loadFactorPct >= 55 && variabilityRatio <= 0.45 && cov <= 0.35) return 'Moderately Variable';
  if (loadFactorPct < 45 || variabilityRatio >= 0.65 || cov >= 0.6) return 'Peak Driven';
  return 'Highly Variable';
}

function buildInsights(hourly, operatingThresholdPct = DEFAULT_OPERATING_THRESHOLD_PCT) {
  const valid = hourly.filter((b) => Number.isFinite(b.avgKw));
  if (!valid.length) {
    return {
      peakOperatingPeriod: null,
      peakLoadKw: null,
      averageLoadKw: null,
      loadFactorPct: null,
      baseLoadKw: null,
      operatingWindow: null,
      loadPattern: 'Unavailable',
      operatingThresholdPct,
      thresholdKw: null,
    };
  }

  const peakBucket = valid.reduce((best, curr) => (curr.avgKw > best.avgKw ? curr : best), valid[0]);
  const averageLoadKwRaw = avg(valid.map((b) => b.avgKw));
  const loadFactorPctRaw = peakBucket.avgKw > 0
    ? ((averageLoadKwRaw || 0) / peakBucket.avgKw) * 100
    : null;

  const overnight = hourly
    .filter((b) => b.hour >= 0 && b.hour <= 5 && Number.isFinite(b.avgKw))
    .map((b) => b.avgKw);
  const baseLoadKwRaw = overnight.length ? avg(overnight) : null;

  const thresholdKwRaw = peakBucket.avgKw * (operatingThresholdPct / 100);
  const operationalHours = valid
    .filter((b) => b.avgKw >= thresholdKwRaw)
    .map((b) => b.hour)
    .sort((a, b) => a - b);
  const operatingWindow = operationalHours.length
    ? `${hourLabel(operationalHours[0])}-${hourLabel((operationalHours[operationalHours.length - 1] + 1) % 24)}`
    : null;

  const averageLoadKw = averageLoadKwRaw != null ? roundTo(averageLoadKwRaw, 2) : null;
  const peakLoadKw = roundTo(peakBucket.avgKw, 2);
  const loadFactorPct = loadFactorPctRaw != null ? roundTo(loadFactorPctRaw, 1) : null;
  const baseLoadKw = baseLoadKwRaw != null ? roundTo(baseLoadKwRaw, 2) : null;
  const thresholdKw = roundTo(thresholdKwRaw, 2);

  return {
    peakOperatingPeriod: hourRangeLabel(peakBucket.hour),
    peakLoadKw,
    averageLoadKw,
    loadFactorPct,
    baseLoadKw,
    operatingWindow,
    loadPattern: classifyLoadPattern(hourly.map((b) => b.avgKw), averageLoadKwRaw, peakBucket.avgKw, loadFactorPctRaw || 0),
    operatingThresholdPct,
    thresholdKw,
  };
}

function emptyLoadProfile() {
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: hourLabel(hour),
    avgKw: null,
    sampleCount: 0,
  }));
  return {
    hourly,
    insights: buildInsights(hourly),
    metadata: {
      timezone: IST_TZ,
      totalSamples: 0,
      nullHours: 24,
      operatingThresholdPct: DEFAULT_OPERATING_THRESHOLD_PCT,
      thresholdKw: null,
    },
  };
}

async function buildFleetLoadProfile(meters, period, options = {}) {
  if (!meters?.length) return emptyLoadProfile();

  const operatingThresholdPct = Number.isFinite(Number(options.operatingThresholdPct))
    ? Number(options.operatingThresholdPct)
    : DEFAULT_OPERATING_THRESHOLD_PCT;
  const { from, to } = period;

  const logFilter = await buildLogFilterForMeters(meters, {
    timestamp: { $gte: from, $lte: to },
  });

  const rows = await EnergyMeterLog.aggregate([
    { $match: logFilter },
    {
      $project: {
        timestamp: 1,
        activePowerKw: {
          $ifNull: [
            { $convert: { input: '$readings.activePower', to: 'double', onError: null, onNull: null } },
            {
              $let: {
                vars: { rawActivePower: { $arrayElemAt: ['$rawValues', 2] } },
                in: {
                  $cond: [
                    { $ne: ['$$rawActivePower', null] },
                    {
                      $divide: [
                        { $convert: { input: '$$rawActivePower', to: 'double', onError: null, onNull: null } },
                        100,
                      ],
                    },
                    null,
                  ],
                },
              },
            },
          ],
        },
      },
    },
    { $match: { activePowerKw: { $ne: null } } },
    {
      $project: {
        activePowerKw: 1,
        hour: {
          $toInt: {
            $dateToString: {
              format: '%H',
              date: '$timestamp',
              timezone: IST_TZ,
            },
          },
        },
      },
    },
    {
      $group: {
        _id: '$hour',
        avgKw: { $avg: '$activePowerKw' },
        sampleCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byHour = {};
  let totalSamples = 0;
  rows.forEach((row) => {
    byHour[row._id] = {
      avgKw: roundTo(row.avgKw, 2),
      sampleCount: row.sampleCount || 0,
    };
    totalSamples += row.sampleCount || 0;
  });

  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: hourLabel(hour),
    avgKw: byHour[hour]?.avgKw ?? null,
    sampleCount: byHour[hour]?.sampleCount ?? 0,
  }));

  const insights = buildInsights(hourly, operatingThresholdPct);

  return {
    hourly,
    insights,
    metadata: {
      timezone: IST_TZ,
      totalSamples,
      nullHours: hourly.filter((b) => b.avgKw == null).length,
      operatingThresholdPct,
      thresholdKw: insights.thresholdKw,
    },
  };
}

module.exports = {
  buildFleetLoadProfile,
  emptyLoadProfile,
  hourLabel,
  hourRangeLabel,
};
