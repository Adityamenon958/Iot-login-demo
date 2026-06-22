const { buildFleetMetricHistory, fetchVisibleLogsInRange } = require('./electricalHealthService');
const { getMetricDefinition } = require('./electricalHealthMetrics');
const { buildReadings, pickReadingValue, pickActivePowerKw } = require('./energyMeterUtils');
const {
  roundTo,
  getTodayStartIstUtc,
  buildComparison,
  countRangeExcursionEvents,
  computeTimeInRangePercent,
  computeTimeBelowPercent,
  computeRunningHours,
  findExtremumPoint,
  computePfCompliance,
  computePenaltyRisk,
  evaluatePfDrilldownStatus,
  evaluateVoltageStatus,
  evaluateFrequencyStatus,
  getDefaultInsightsConfig,
  VOLTAGE_BAND,
  PF_DRILLDOWN_BANDS,
  FREQUENCY_BAND,
  RUNNING_POWER_THRESHOLD_KW,
} = require('./meterInsightsUtils');

const PF_DRILLDOWN_REFERENCE_LINES = [
  { value: 0.95, label: '0.95 healthy', stroke: '#198754' },
  { value: 0.9, label: '0.90 warn', stroke: '#fd7e14' },
];

function getPowerFromLog(log) {
  let readings = log.readings;
  if (!readings || !Object.keys(readings).length) {
    readings = buildReadings(log.rawValues || [], []);
  }
  return pickActivePowerKw(readings);
}

function buildChartSeriesPayload(history, metricKey) {
  const series = history.chartSeries?.[0];
  if (!series) {
    return {
      chartSeries: [],
      points: [],
      statistics: {},
    };
  }

  return {
    chartSeries: history.chartSeries,
    points: series.points || [],
    statistics: series.statistics || {},
    status: series.status,
  };
}

function buildMetricSummary(metricKey, statistics, status) {
  if (metricKey === 'activePower') {
    return {
      currentPower: statistics.currentPower,
      peakPower: statistics.peakPower,
      averagePower: statistics.averagePower,
      loadFactor: statistics.loadFactor,
      energyInRange: statistics.energyInRange,
      status: status || 'unknown',
    };
  }

  return {
    current: statistics.current,
    min: statistics.min,
    max: statistics.max,
    average: statistics.average,
    variation: statistics.variation,
    timeInRangePercent: statistics.timeInRangePercent,
    status: status || 'unknown',
  };
}

function buildMetricInsights(metricKey, points, rawLogs, statistics) {
  const insights = {};

  if (metricKey === 'activePower') {
    const powerPoints = points.map((p) => ({ timestamp: p.timestamp, value: p.value }));
    const peak = findExtremumPoint(powerPoints, 'max');
    const low = findExtremumPoint(powerPoints, 'min');
    const now = new Date();
    const todayStart = getTodayStartIstUtc(now);
    const todayLogs = rawLogs.filter((log) => new Date(log.timestamp) >= todayStart);

    insights.runningHoursToday = computeRunningHours(todayLogs, getPowerFromLog);
    insights.runningHoursInPeriod = computeRunningHours(rawLogs, getPowerFromLog);
    insights.peakDemandAt = peak?.timestamp || null;
    insights.peakDemandKw = peak?.value ?? statistics.peakPower;
    insights.lowestDemandAt = low?.timestamp || null;
    insights.lowestDemandKw = low?.value ?? null;
    insights.runningThresholdKw = RUNNING_POWER_THRESHOLD_KW;
    return insights;
  }

  if (metricKey === 'voltage') {
    const vPoints = points.map((p) => ({ timestamp: p.timestamp, value: p.value }));
    insights.undervoltageEventCount = countRangeExcursionEvents(vPoints, {
      lower: VOLTAGE_BAND.lower,
      upper: VOLTAGE_BAND.upper,
      mode: 'under',
    });
    insights.overvoltageEventCount = countRangeExcursionEvents(vPoints, {
      lower: VOLTAGE_BAND.lower,
      upper: VOLTAGE_BAND.upper,
      mode: 'over',
    });
    insights.timeInRangePercent = computeTimeInRangePercent(
      vPoints,
      VOLTAGE_BAND.lower,
      VOLTAGE_BAND.upper
    );
    return insights;
  }

  if (metricKey === 'current') {
    const cPoints = points.map((p) => ({ timestamp: p.timestamp, value: p.value }));
    const peak = findExtremumPoint(cPoints, 'max');
    const low = findExtremumPoint(cPoints, 'min');
    insights.peakCurrentAt = peak?.timestamp || null;
    insights.peakCurrent = peak?.value ?? statistics.max;
    insights.lowestCurrentAt = low?.timestamp || null;
    insights.lowestCurrent = low?.value ?? statistics.min;
    return insights;
  }

  if (metricKey === 'powerFactor') {
    const pfPoints = points.map((p) => ({ timestamp: p.timestamp, value: p.value }));
    const compliance = computePfCompliance(pfPoints);
    const minPt = findExtremumPoint(pfPoints, 'min');
    insights.pfCompliancePercent = compliance;
    insights.penaltyRisk = computePenaltyRisk(compliance, statistics.min);
    insights.worstPfAt = minPt?.timestamp || null;
    insights.worstPf = minPt?.value ?? statistics.min;
    insights.timeBelowNinetyPercent = computeTimeBelowPercent(pfPoints, PF_DRILLDOWN_BANDS.warning);
    return insights;
  }

  if (metricKey === 'frequency') {
    const fPoints = points.map((p) => ({ timestamp: p.timestamp, value: p.value }));
    insights.timeInHealthyBandPercent = computeTimeInRangePercent(
      fPoints,
      FREQUENCY_BAND.lower,
      FREQUENCY_BAND.upper
    );
    return insights;
  }

  return insights;
}

function resolveStatus(metricKey, statistics) {
  if (metricKey === 'voltage') return evaluateVoltageStatus(statistics.current);
  if (metricKey === 'powerFactor') return evaluatePfDrilldownStatus(statistics.current);
  if (metricKey === 'frequency') return evaluateFrequencyStatus(statistics.current);
  return statistics.status || 'unknown';
}

function buildReferenceLines(metricKey, history) {
  if (metricKey === 'powerFactor') return PF_DRILLDOWN_REFERENCE_LINES;
  return history.referenceLines || [];
}

async function buildMeterMetricInsights(device, metricKey, rangeKey = '24h') {
  const metricDef = getMetricDefinition(metricKey);
  if (!metricDef) {
    throw new Error(`Unknown metric: ${metricKey}`);
  }

  const history = await buildFleetMetricHistory([device], metricKey, rangeKey);
  const { logs: rawLogs } = await fetchVisibleLogsInRange([device], rangeKey);
  const series = history.chartSeries?.[0];
  const points = series?.points || [];

  const statistics = { ...(series?.statistics || {}) };
  const status = resolveStatus(metricKey, statistics);

  if (metricKey === 'voltage') {
    const vPoints = points.map((p) => ({ value: p.value }));
    statistics.timeInRangePercent = computeTimeInRangePercent(
      vPoints,
      VOLTAGE_BAND.lower,
      VOLTAGE_BAND.upper
    );
  }

  if (metricKey === 'frequency') {
    const fPoints = points.map((p) => ({ value: p.value }));
    statistics.timeInRangePercent = computeTimeInRangePercent(
      fPoints,
      FREQUENCY_BAND.lower,
      FREQUENCY_BAND.upper
    );
  }

  const insights = buildMetricInsights(metricKey, points, rawLogs, statistics);
  const summary = buildMetricSummary(metricKey, statistics, status);

  const comparisons = {};
  if (metricKey === 'activePower' && statistics.peakPower != null) {
    comparisons.peakInRange = buildComparison(statistics.peakPower, null);
  }

  return {
    meterId: device.deviceId,
    metric: metricKey,
    range: history.range,
    timezone: 'Asia/Kolkata',
    config: getDefaultInsightsConfig(),
    label: metricDef.label,
    unit: metricDef.unit,
    decimals: metricDef.decimals,
    summary,
    comparisons,
    charts: {
      chartSeries: history.chartSeries,
      referenceLines: buildReferenceLines(metricKey, history),
      dataStart: history.dataStart,
      dataEnd: history.dataEnd,
      requestedSince: history.requestedSince,
      requestedUntil: history.requestedUntil,
    },
    insights,
  };
}

module.exports = {
  buildMeterMetricInsights,
  buildMetricInsights,
  PF_DRILLDOWN_REFERENCE_LINES,
};
