const {
  parseChartRange,
  buildReadings,
  pickReadingValue,
  roundToDecimals,
  buildLogFilterForMeters,
} = require('./energyMeterUtils');
const EnergyMeterLog = require('../models/EnergyMeterLog');
const {
  ELECTRICAL_HEALTH_METRICS,
  DOWNSAMPLE_MAX_POINTS,
  SPARKLINE_MAX_POINTS,
  MINI_CHART_METER_LIMIT,
  getMetricDefinition,
  evaluateMeterStatus,
  worstStatus,
} = require('./electricalHealthMetrics');

function extractLogMetricValue(log, metricKey) {
  let readings = log.readings;
  if (!readings || !Object.keys(readings).length) {
    readings = buildReadings(log.rawValues || [], []);
  }
  return pickReadingValue(readings, metricKey);
}

function extractLogEnergy(log) {
  let readings = log.readings;
  if (!readings || !Object.keys(readings).length) {
    readings = buildReadings(log.rawValues || [], []);
  }
  return pickReadingValue(readings, 'energy');
}

async function fetchVisibleLogsInRange(meters, rangeKey) {
  const meterIds = meters.map((m) => m.deviceId).filter(Boolean);
  const { key, ms } = parseChartRange(rangeKey);
  const requestedUntil = new Date();
  const requestedSince = new Date(requestedUntil.getTime() - ms);

  if (!meterIds.length) {
    return { rangeKey: key, requestedSince, requestedUntil, logs: [], meterMeta: {} };
  }

  const meterMeta = {};
  meters.forEach((m) => {
    meterMeta[m.deviceId] = {
      machineName: m.machineName || '',
      siteName: m.siteName || '',
    };
  });

  const logFilter = await buildLogFilterForMeters(meters, {
    meterId: { $in: meterIds },
    timestamp: { $gte: requestedSince },
  });

  const logs = await EnergyMeterLog.find(logFilter).sort({ timestamp: 1 }).lean();

  return { rangeKey: key, requestedSince, requestedUntil, logs, meterMeta };
}

function pointKey(pt) {
  return `${new Date(pt.timestamp).getTime()}:${pt.value}`;
}

function addUniquePoint(seen, result, pt) {
  if (!pt) return;
  const key = pointKey(pt);
  if (seen.has(key)) return;
  seen.add(key);
  result.push(pt);
}

/** Keep first/last/min/max per time bucket so brief spikes and dips survive downsampling. */
function downsampleSeries(points, maxPoints, rangeKey, requestedSince) {
  if (!points?.length) return { points: [], originalCount: 0, downsampled: false };
  const originalCount = points.length;
  const cap = DOWNSAMPLE_MAX_POINTS[rangeKey] ?? maxPoints;

  if (rangeKey === '15m' || rangeKey === '1h') {
    if (originalCount <= cap) {
      return { points, originalCount, downsampled: false };
    }
  }

  if (originalCount <= maxPoints) {
    return { points, originalCount, downsampled: false };
  }

  const rangeStart = requestedSince ? new Date(requestedSince).getTime() : new Date(points[0].timestamp).getTime();
  const rangeEnd = new Date(points[points.length - 1].timestamp).getTime();
  const rangeMs = Math.max(rangeEnd - rangeStart, 1);
  const bucketWidth = rangeMs / maxPoints;
  const bucketMap = new Map();

  points.forEach((pt) => {
    const t = new Date(pt.timestamp).getTime();
    const bucket = Math.floor((t - rangeStart) / bucketWidth);
    const existing = bucketMap.get(bucket);
    if (!existing) {
      bucketMap.set(bucket, { first: pt, last: pt, min: pt, max: pt });
      return;
    }
    existing.last = pt;
    if (pt.value < existing.min.value) existing.min = pt;
    if (pt.value > existing.max.value) existing.max = pt;
  });

  const seen = new Set();
  const result = [];

  Array.from(bucketMap.keys())
    .sort((a, b) => a - b)
    .forEach((bucket) => {
      const { first, last, min, max } = bucketMap.get(bucket);
      addUniquePoint(seen, result, first);
      addUniquePoint(seen, result, min);
      addUniquePoint(seen, result, max);
      addUniquePoint(seen, result, last);
    });

  let globalMin = points[0];
  let globalMax = points[0];
  points.forEach((pt) => {
    if (pt.value < globalMin.value) globalMin = pt;
    if (pt.value > globalMax.value) globalMax = pt;
  });

  const first = points[0];
  const last = points[points.length - 1];
  addUniquePoint(seen, result, first);
  addUniquePoint(seen, result, last);
  addUniquePoint(seen, result, globalMin);
  addUniquePoint(seen, result, globalMax);

  result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return { points: result, originalCount, downsampled: true };
}

function computeStandardStatistics(values, metricDef) {
  const nums = values.filter((v) => v != null && Number.isFinite(v));
  if (!nums.length) {
    return { current: null, min: null, max: null, average: null, variation: null };
  }

  const decimals = metricDef?.decimals ?? 2;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const average = nums.reduce((s, v) => s + v, 0) / nums.length;
  const current = nums[nums.length - 1];

  const stats = {
    current: roundToDecimals(current, decimals),
    min: roundToDecimals(min, decimals),
    max: roundToDecimals(max, decimals),
    average: roundToDecimals(average, decimals),
    variation: null,
  };

  if (metricDef?.showVariation) {
    stats.variation = roundToDecimals(max - min, decimals);
  }

  return stats;
}

function computeActivePowerStatistics(logsForMeter, metricDef) {
  const powerValues = [];
  const energyValues = [];

  logsForMeter.forEach((log) => {
    const p = extractLogMetricValue(log, 'activePower');
    const e = extractLogEnergy(log);
    if (p != null) powerValues.push(p);
    if (e != null) energyValues.push({ ts: log.timestamp, value: e });
  });

  const decimals = metricDef?.decimals ?? 2;

  if (!powerValues.length) {
    return {
      currentPower: null,
      peakPower: null,
      averagePower: null,
      energyInRange: null,
      loadFactor: null,
    };
  }

  const peakPower = Math.max(...powerValues);
  const averagePower = powerValues.reduce((s, v) => s + v, 0) / powerValues.length;
  const currentPower = powerValues[powerValues.length - 1];

  let energyInRange = null;
  if (energyValues.length >= 2) {
    const first = energyValues[0].value;
    const last = energyValues[energyValues.length - 1].value;
    if (Number.isFinite(first) && Number.isFinite(last)) {
      energyInRange = roundToDecimals(Math.max(0, last - first), 2);
    }
  }

  let loadFactor = null;
  if (peakPower > 0 && averagePower != null) {
    loadFactor = roundToDecimals(averagePower / peakPower, 2);
  }

  return {
    currentPower: roundToDecimals(currentPower, decimals),
    peakPower: roundToDecimals(peakPower, decimals),
    averagePower: roundToDecimals(averagePower, decimals),
    energyInRange,
    loadFactor,
  };
}

function buildMeterSeriesFromLogs(logs, metricKey, metricDef) {
  const byMeter = {};

  logs.forEach((log) => {
    const meterId = log.meterId;
    if (!meterId) return;

    let value;
    if (metricKey === 'activePower') {
      value = extractLogMetricValue(log, 'activePower');
    } else {
      value = extractLogMetricValue(log, metricKey);
    }

    if (!byMeter[meterId]) {
      byMeter[meterId] = { points: [], rawLogs: [] };
    }
    byMeter[meterId].rawLogs.push(log);
    if (value != null) {
      byMeter[meterId].points.push({ timestamp: log.timestamp, value });
    }
  });

  return byMeter;
}

function computeLatestRange(meterLatestValues) {
  const vals = meterLatestValues.filter((v) => v != null && Number.isFinite(v));
  if (!vals.length) return null;
  if (vals.length === 1) return { min: vals[0], max: vals[0], single: true };
  return { min: Math.min(...vals), max: Math.max(...vals), single: false };
}

function pickHighestLoad(meterLatestMap, meterMeta) {
  let best = null;
  Object.entries(meterLatestMap).forEach(([meterId, value]) => {
    if (value == null || !Number.isFinite(value)) return;
    if (!best || value > best.value) {
      best = {
        meterId,
        value,
        displayName: meterMeta[meterId]?.machineName || meterId,
      };
    }
  });
  return best;
}

function countAlerts(metricDef, meterLatestMap) {
  if (!metricDef || metricDef.statusRules === 'none') {
    return { alertCount: 0, criticalCount: 0, healthStatus: 'unknown' };
  }

  let alertCount = 0;
  let criticalCount = 0;
  let healthStatus = 'healthy';

  Object.values(meterLatestMap).forEach((value) => {
    const status = evaluateMeterStatus(metricDef, value);
    if (status === 'warning') {
      alertCount += 1;
      healthStatus = worstStatus(healthStatus, 'warning');
    } else if (status === 'critical') {
      alertCount += 1;
      criticalCount += 1;
      healthStatus = 'critical';
    }
  });

  if (alertCount === 0 && Object.values(meterLatestMap).every((v) => v == null)) {
    healthStatus = 'unknown';
  }

  return { alertCount, criticalCount, healthStatus };
}

function pickTopActiveMetersForMiniChart(chartSeries, limit = MINI_CHART_METER_LIMIT) {
  const sorted = [...chartSeries].sort((a, b) => {
    const aTs = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
    const bTs = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
    return bTs - aTs;
  });

  const included = new Set(sorted.slice(0, limit).map((s) => s.meterId));
  const hiddenMeterCount = Math.max(0, chartSeries.length - limit);

  const flagged = chartSeries.map((s) => ({
    ...s,
    isIncludedInMiniChart: included.has(s.meterId),
  }));

  return [flagged, hiddenMeterCount];
}

function buildChartSeriesForMetric(logs, metricKey, metricDef, rangeKey, requestedSince, maxPoints) {
  const byMeter = buildMeterSeriesFromLogs(logs, metricKey, metricDef);
  const chartSeries = [];

  Object.entries(byMeter).forEach(([meterId, { points, rawLogs }]) => {
    let statistics;
    let status;

    if (metricKey === 'activePower') {
      statistics = computeActivePowerStatistics(rawLogs, metricDef);
      status = 'unknown';
    } else {
      const values = points.map((p) => p.value);
      statistics = computeStandardStatistics(values, metricDef);
      status = evaluateMeterStatus(metricDef, statistics.current);
    }

    const { points: dsPoints, originalCount, downsampled } = downsampleSeries(
      points,
      maxPoints,
      rangeKey,
      requestedSince
    );

    const lastActiveAt = points.length ? points[points.length - 1].timestamp : null;

    chartSeries.push({
      meterId,
      points: dsPoints,
      originalPointCount: originalCount,
      downsampled,
      statistics,
      status,
      lastActiveAt,
    });
  });

  return chartSeries;
}

function buildMetricSummaryFromSeries(metricDef, chartSeries) {
  const meterLatestMap = {};
  chartSeries.forEach((s) => {
    if (metricDef.key === 'activePower') {
      meterLatestMap[s.meterId] = s.statistics?.currentPower ?? null;
    } else {
      meterLatestMap[s.meterId] = s.statistics?.current ?? null;
    }
  });

  const { alertCount, criticalCount, healthStatus } = countAlerts(metricDef, meterLatestMap);

  let alertSummary = null;
  if (metricDef.statusRules !== 'none') {
    if (alertCount > 0 && metricDef.cardAlertLabel) {
      alertSummary = `${alertCount} meter${alertCount > 1 ? 's' : ''} ${metricDef.cardAlertLabel}`;
    } else if (alertCount === 0 && Object.values(meterLatestMap).some((v) => v != null)) {
      alertSummary = 'Healthy';
    }
  }

  const result = {
    key: metricDef.key,
    label: metricDef.label,
    unit: metricDef.unit,
    decimals: metricDef.decimals,
    cardDisplayMode: metricDef.cardDisplayMode,
    alertCount,
    criticalCount,
    alertSummary,
    healthStatus: metricDef.statusRules === 'none' ? 'unknown' : healthStatus,
    miniChartMeterLimit: MINI_CHART_METER_LIMIT,
  };

  if (metricDef.cardDisplayMode === 'highestLoad') {
    const meterMeta = {};
    chartSeries.forEach((s) => {
      meterMeta[s.meterId] = { machineName: s.machineName || '' };
    });
    const highest = pickHighestLoad(meterLatestMap, meterMeta);
    result.highestLoad = highest
      ? { meterId: highest.meterId, displayName: highest.displayName, value: highest.value, unit: metricDef.unit }
      : null;
  } else {
    const latestRange = computeLatestRange(Object.values(meterLatestMap));
    result.latestRange = latestRange;
  }

  const [seriesWithFlags, hiddenMeterCount] = pickTopActiveMetersForMiniChart(chartSeries);
  result.chartSeries = seriesWithFlags;
  result.hiddenMeterCount = hiddenMeterCount;

  return result;
}

async function buildElectricalHealthSummary(meters, rangeKey = '1h') {
  const { rangeKey: key, requestedSince, requestedUntil, logs, meterMeta } =
    await fetchVisibleLogsInRange(meters, rangeKey);

  const metrics = {};

  ELECTRICAL_HEALTH_METRICS.forEach((metricDef) => {
    const chartSeries = buildChartSeriesForMetric(
      logs,
      metricDef.key,
      metricDef,
      key,
      requestedSince,
      SPARKLINE_MAX_POINTS
    ).map((s) => ({
      ...s,
      machineName: meterMeta[s.meterId]?.machineName || '',
      siteName: meterMeta[s.meterId]?.siteName || '',
    }));

    metrics[metricDef.key] = buildMetricSummaryFromSeries(metricDef, chartSeries);
  });

  return {
    range: key,
    requestedSince,
    requestedUntil,
    metrics,
  };
}

async function buildFleetMetricHistory(meters, metricKey, rangeKey = '24h') {
  const metricDef = getMetricDefinition(metricKey);
  if (!metricDef) {
    throw new Error(`Unknown metric: ${metricKey}`);
  }

  const { rangeKey: key, requestedSince, requestedUntil, logs, meterMeta } =
    await fetchVisibleLogsInRange(meters, rangeKey);

  let dataStart = null;
  let dataEnd = null;
  logs.forEach((log) => {
    const ts = log.timestamp;
    if (!dataStart || new Date(ts) < new Date(dataStart)) dataStart = ts;
    if (!dataEnd || new Date(ts) > new Date(dataEnd)) dataEnd = ts;
  });

  const maxPoints = DOWNSAMPLE_MAX_POINTS[key] ?? 200;

  const chartSeries = buildChartSeriesForMetric(
    logs,
    metricKey,
    metricDef,
    key,
    requestedSince,
    maxPoints
  ).map((s) => ({
    ...s,
    machineName: meterMeta[s.meterId]?.machineName || '',
    siteName: meterMeta[s.meterId]?.siteName || '',
    isIncludedInMiniChart: true,
  }));

  const meterLatestMap = {};
  chartSeries.forEach((s) => {
    if (metricKey === 'activePower') {
      meterLatestMap[s.meterId] = s.statistics?.currentPower ?? null;
    } else {
      meterLatestMap[s.meterId] = s.statistics?.current ?? null;
    }
  });

  const latestRange = computeLatestRange(Object.values(meterLatestMap));

  return {
    metric: metricKey,
    label: metricDef.label,
    unit: metricDef.unit,
    decimals: metricDef.decimals,
    thresholds: metricDef.thresholds,
    referenceLines: metricDef.referenceLines,
    statsColumns: metricDef.statsColumns,
    statsLabels: metricDef.statsLabels || {},
    showVariation: metricDef.showVariation,
    range: key,
    requestedSince,
    requestedUntil,
    dataStart,
    dataEnd,
    downsamplePolicy: {
      maxPoints,
      method: 'time-bucket-last-value',
    },
    latestRange,
    chartSeries,
  };
}

module.exports = {
  fetchVisibleLogsInRange,
  buildElectricalHealthSummary,
  buildFleetMetricHistory,
  buildChartSeriesForMetric,
  extractLogMetricValue,
  downsampleSeries,
};
