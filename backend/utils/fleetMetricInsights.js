const { buildFleetMetricHistory, fetchVisibleLogsInRange } = require('./electricalHealthService');
const { getMetricDefinition } = require('./electricalHealthMetrics');
const {
  buildReadings,
  pickReadingValue,
  pickActivePowerKw,
  computeTodayEnergyConsumptionByMeter,
  isMeterOnline,
} = require('./energyMeterUtils');
const {
  buildMetricInsights,
  PF_DRILLDOWN_REFERENCE_LINES,
} = require('./meterMetricInsights');
const {
  roundTo,
  getTodayStartIstUtc,
  computeTimeInRangePercent,
  computePfCompliance,
  computePenaltyRisk,
  computeFleetHealthScore,
  buildRankingRows,
  buildRankingRowsAsc,
  getDefaultInsightsConfig,
  VOLTAGE_BAND,
  PF_DRILLDOWN_BANDS,
  FREQUENCY_BAND,
  countRangeExcursionEvents,
} = require('./meterInsightsUtils');

const RANKING_LIMIT = 5;

function getPowerFromLog(log) {
  let readings = log.readings;
  if (!readings || !Object.keys(readings).length) {
    readings = buildReadings(log.rawValues || [], []);
  }
  return pickActivePowerKw(readings);
}

function buildReferenceLines(metricKey, history) {
  if (metricKey === 'powerFactor') return PF_DRILLDOWN_REFERENCE_LINES;
  return history.referenceLines || [];
}

function groupLogsByMeter(logs) {
  const map = {};
  logs.forEach((log) => {
    if (!map[log.meterId]) map[log.meterId] = [];
    map[log.meterId].push(log);
  });
  return map;
}

function averageFinite(values, decimals = 2) {
  const nums = values.filter((v) => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  return roundTo(nums.reduce((s, v) => s + v, 0) / nums.length, decimals);
}

function buildFleetSnapshot(meters, chartSeries, dataEnd) {
  const reportingMeterCount = chartSeries.filter((s) => (s.points || []).length > 0).length;
  const onlineMeterCount = meters.filter((m) => {
    const series = chartSeries.find((s) => s.meterId === m.deviceId);
    const lastTs = series?.points?.length
      ? series.points[series.points.length - 1].timestamp
      : null;
    return lastTs && isMeterOnline(lastTs);
  }).length;

  return {
    reportingMeterCount,
    totalMeterCount: meters.length,
    lastUpdated: dataEnd || null,
    onlineMeterCount,
  };
}

async function buildFleetMetricInsights(meters, metricKey, rangeKey = '24h') {
  const metricDef = getMetricDefinition(metricKey);
  if (!metricDef) throw new Error(`Unknown metric: ${metricKey}`);

  const history = await buildFleetMetricHistory(meters, metricKey, rangeKey);
  const { logs } = await fetchVisibleLogsInRange(meters, rangeKey);
  const logsByMeter = groupLogsByMeter(logs);

  const meterMeta = {};
  meters.forEach((m) => {
    meterMeta[m.deviceId] = {
      machineName: m.machineName || '',
      siteName: m.siteName || '',
    };
  });

  const chartSeries = history.chartSeries || [];
  const fleetSnapshot = buildFleetSnapshot(meters, chartSeries, history.dataEnd);

  const perMeter = chartSeries.map((series) => {
    const meterId = series.meterId;
    const meta = meterMeta[meterId] || {};
    const points = series.points || [];
    const rawLogs = logsByMeter[meterId] || [];
    const statistics = { ...(series.statistics || {}) };

    if (metricKey === 'voltage') {
      statistics.timeInRangePercent = computeTimeInRangePercent(
        points.map((p) => ({ value: p.value })),
        VOLTAGE_BAND.lower,
        VOLTAGE_BAND.upper
      );
    }
    if (metricKey === 'frequency') {
      statistics.timeInRangePercent = computeTimeInRangePercent(
        points.map((p) => ({ value: p.value })),
        FREQUENCY_BAND.lower,
        FREQUENCY_BAND.upper
      );
    }

    const insights = buildMetricInsights(metricKey, points, rawLogs, statistics);

    return {
      meterId,
      machineName: meta.machineName,
      siteName: meta.siteName,
      statistics,
      insights,
      points,
    };
  });

  const rankings = {};
  const insights = {};
  let summary = {};

  if (metricKey === 'activePower') {
    const currentPowers = perMeter
      .map((m) => ({
        meterId: m.meterId,
        machineName: m.machineName,
        siteName: m.siteName,
        value: m.statistics.currentPower,
        unit: 'kW',
      }))
      .filter((m) => m.value != null);

    const fleetCurrentPower = currentPowers.reduce((s, m) => s + m.value, 0);
    const peakPowers = perMeter.map((m) => m.statistics.peakPower).filter((v) => v != null);
    const fleetPeakToday = peakPowers.length ? Math.max(...peakPowers) : null;
    const fleetAvgPower = averageFinite(perMeter.map((m) => m.statistics.averagePower));
    const fleetPeak = averageFinite(peakPowers) != null
      ? Math.max(...peakPowers)
      : null;
    const peakPower = fleetPeak;
    const avgPower = fleetAvgPower;
    const loadFactor =
      peakPower > 0 && avgPower != null ? roundTo(avgPower / peakPower, 2) : null;

    const todayStart = getTodayStartIstUtc();
    const todayEnergy = await computeTodayEnergyConsumptionByMeter(meters, todayStart);
    const todayConsumers = Object.entries(todayEnergy.byMeter).map(([meterId, kwh]) => ({
      meterId,
      machineName: meterMeta[meterId]?.machineName,
      siteName: meterMeta[meterId]?.siteName,
      value: kwh,
      unit: 'kWh',
    }));

    const topNow = buildRankingRows(currentPowers, 'value', 'kW', 1)[0];
    const topToday = buildRankingRows(todayConsumers, 'value', 'kWh', 1)[0];

    let fleetPeakAt = null;
    let fleetLowAt = null;
    let fleetRunningHoursToday = 0;
    let fleetRunningHoursPeriod = 0;

    perMeter.forEach((m) => {
      fleetRunningHoursToday += m.insights.runningHoursToday || 0;
      fleetRunningHoursPeriod += m.insights.runningHoursInPeriod || 0;
      if (m.insights.peakDemandAt) {
        if (!fleetPeakAt || new Date(m.insights.peakDemandAt) > new Date(fleetPeakAt)) {
          fleetPeakAt = m.insights.peakDemandAt;
        }
      }
      if (m.insights.lowestDemandAt) {
        if (!fleetLowAt || new Date(m.insights.lowestDemandAt) < new Date(fleetLowAt)) {
          fleetLowAt = m.insights.lowestDemandAt;
        }
      }
    });

    summary = {
      fleetCurrentPower: roundTo(fleetCurrentPower, 2),
      topConsumerRightNow: topNow
        ? { meterId: topNow.meterId, name: topNow.machineName, value: topNow.value, unit: 'kW' }
        : null,
      topConsumerToday: topToday
        ? { meterId: topToday.meterId, name: topToday.machineName, value: topToday.value, unit: 'kWh' }
        : null,
      peakFleetPowerToday: roundTo(fleetPeakToday, 2),
      averageFleetPower: fleetAvgPower,
      activeMeterCount: currentPowers.length,
      fleetLoadFactor: loadFactor,
    };

    insights.peakDemandAt = fleetPeakAt;
    insights.lowestDemandAt = fleetLowAt;
    insights.fleetRunningHoursToday = roundTo(fleetRunningHoursToday, 1);
    insights.fleetRunningHoursInPeriod = roundTo(fleetRunningHoursPeriod, 1);

    rankings.topConsumers = buildRankingRows(currentPowers, 'value', 'kW', RANKING_LIMIT);
  }

  if (metricKey === 'powerFactor') {
    const pfValues = perMeter.map((m) => m.statistics.current).filter((v) => v != null);
    const mins = perMeter.map((m) => m.statistics.min).filter((v) => v != null);
    const maxs = perMeter.map((m) => m.statistics.max).filter((v) => v != null);

    const allPfPoints = [];
    perMeter.forEach((m) => {
      m.points.forEach((p) => {
        if (p.value != null) allPfPoints.push({ value: p.value });
      });
    });
    const fleetCompliance = computePfCompliance(allPfPoints);
    const metersBelow = perMeter.filter(
      (m) => m.statistics.min != null && m.statistics.min < PF_DRILLDOWN_BANDS.warning
    ).length;
    const metersBelowPct = perMeter.length
      ? roundTo((metersBelow / perMeter.length) * 100, 1)
      : 0;

    const penaltyCounts = { Low: 0, Medium: 0, High: 0 };
    perMeter.forEach((m) => {
      const risk = m.insights.penaltyRisk;
      if (penaltyCounts[risk] != null) penaltyCounts[risk] += 1;
    });

    summary = {
      fleetAveragePf: averageFinite(pfValues, 2),
      healthScore: computeFleetHealthScore('powerFactor', {
        compliancePercent: fleetCompliance,
        metersBelowThresholdPct: metersBelowPct,
      }),
      fleetMinPf: mins.length ? Math.min(...mins) : null,
      fleetMaxPf: maxs.length ? Math.max(...maxs) : null,
      fleetPfCompliancePercent: fleetCompliance,
      metersBelowThreshold: metersBelow,
    };

    insights.penaltyRiskLow = penaltyCounts.Low;
    insights.penaltyRiskMedium = penaltyCounts.Medium;
    insights.penaltyRiskHigh = penaltyCounts.High;

    const pfRankWorst = perMeter.map((m) => ({
      meterId: m.meterId,
      machineName: m.machineName,
      siteName: m.siteName,
      value: m.statistics.min,
      unit: '',
    }));
    const pfRankBest = perMeter.map((m) => ({
      meterId: m.meterId,
      machineName: m.machineName,
      siteName: m.siteName,
      value: m.statistics.current,
      unit: '',
    }));
    rankings.worstPf = buildRankingRowsAsc(pfRankWorst, 'value', '', RANKING_LIMIT);
    rankings.bestPf = buildRankingRows(pfRankBest, 'value', '', RANKING_LIMIT);
  }

  if (metricKey === 'current') {
    const currentNow = perMeter
      .map((m) => ({
        meterId: m.meterId,
        machineName: m.machineName,
        siteName: m.siteName,
        value: m.statistics.current,
        unit: 'A',
      }))
      .filter((m) => m.value != null);
    const mins = perMeter.map((m) => m.statistics.min).filter((v) => v != null);
    const maxs = perMeter.map((m) => m.statistics.max).filter((v) => v != null);
    const avgs = perMeter.map((m) => m.statistics.average).filter((v) => v != null);
    const topNow = buildRankingRows(currentNow, 'value', 'A', 1)[0];
    const peakCurrent = maxs.length ? Math.max(...maxs) : null;
    const minCurrent = mins.length ? Math.min(...mins) : null;

    summary = {
      fleetAverageCurrent: averageFinite(avgs, 2),
      currentFleetCurrent: averageFinite(currentNow.map((m) => m.value), 2),
      topConsumerRightNow: topNow
        ? { meterId: topNow.meterId, name: topNow.machineName, value: topNow.value, unit: 'A' }
        : null,
      peakFleetCurrent: peakCurrent != null ? roundTo(peakCurrent, 2) : null,
      minFleetCurrent: minCurrent != null ? roundTo(minCurrent, 2) : null,
      activeMeterCount: currentNow.length,
    };

    let peakAt = null;
    let lowAt = null;
    perMeter.forEach((m) => {
      if (m.insights.peakCurrentAt) {
        if (!peakAt || new Date(m.insights.peakCurrentAt) > new Date(peakAt)) {
          peakAt = m.insights.peakCurrentAt;
        }
      }
      if (m.insights.lowestCurrentAt) {
        if (!lowAt || new Date(m.insights.lowestCurrentAt) < new Date(lowAt)) {
          lowAt = m.insights.lowestCurrentAt;
        }
      }
    });
    insights.peakCurrentAt = peakAt;
    insights.lowestCurrentAt = lowAt;

    rankings.topCurrentMeters = buildRankingRows(currentNow, 'value', 'A', RANKING_LIMIT);
  }

  if (metricKey === 'voltage') {
    const currents = perMeter.map((m) => m.statistics.current).filter((v) => v != null);
    const mins = perMeter.map((m) => m.statistics.min).filter((v) => v != null);
    const maxs = perMeter.map((m) => m.statistics.max).filter((v) => v != null);
    const variations = perMeter.map((m) => m.statistics.variation).filter((v) => v != null);

    const allVPoints = [];
    let totalSamples = 0;
    let inRangeSamples = 0;
    let underEvents = 0;
    let overEvents = 0;
    let underAffected = 0;
    let overAffected = 0;

    perMeter.forEach((m) => {
      const vPoints = m.points.map((p) => ({ value: p.value, timestamp: p.timestamp }));
      vPoints.forEach((p) => {
        if (p.value != null) {
          totalSamples += 1;
          if (p.value >= VOLTAGE_BAND.lower && p.value <= VOLTAGE_BAND.upper) inRangeSamples += 1;
        }
      });
      const u = countRangeExcursionEvents(vPoints, {
        lower: VOLTAGE_BAND.lower,
        upper: VOLTAGE_BAND.upper,
        mode: 'under',
      });
      const o = countRangeExcursionEvents(vPoints, {
        lower: VOLTAGE_BAND.lower,
        upper: VOLTAGE_BAND.upper,
        mode: 'over',
      });
      underEvents += u;
      overEvents += o;
      if (u > 0) underAffected += 1;
      if (o > 0) overAffected += 1;
    });

    const timeInRange = totalSamples
      ? roundTo((inRangeSamples / totalSamples) * 100, 1)
      : null;
    const eventPenalty = Math.min(100, (underEvents + overEvents) * 5);

    summary = {
      fleetAverageVoltage: averageFinite(currents, 1),
      healthScore: computeFleetHealthScore('voltage', {
        timeInRangePercent: timeInRange,
        eventPenalty,
      }),
      fleetMinVoltage: mins.length ? Math.min(...mins) : null,
      fleetMaxVoltage: maxs.length ? Math.max(...maxs) : null,
      fleetVoltageVariation: variations.length ? Math.max(...variations) : null,
      timeInRangePercent: timeInRange,
    };

    insights.undervoltageEvents = underEvents;
    insights.undervoltageAffectedMeters = underAffected;
    insights.overvoltageEvents = overEvents;
    insights.overvoltageAffectedMeters = overAffected;

    const unstableItems = perMeter.map((m) => ({
      meterId: m.meterId,
      machineName: m.machineName,
      siteName: m.siteName,
      value: m.statistics.variation,
      unit: 'V',
    }));
    const lowVItems = perMeter.map((m) => ({
      meterId: m.meterId,
      machineName: m.machineName,
      siteName: m.siteName,
      value: m.statistics.min,
      unit: 'V',
      decimals: 1,
    }));
    rankings.mostUnstable = buildRankingRows(unstableItems, 'value', 'V', RANKING_LIMIT);
    rankings.lowestVoltage = buildRankingRowsAsc(lowVItems, 'value', 'V', RANKING_LIMIT);
  }

  if (metricKey === 'frequency') {
    const currents = perMeter.map((m) => m.statistics.current).filter((v) => v != null);
    const mins = perMeter.map((m) => m.statistics.min).filter((v) => v != null);
    const maxs = perMeter.map((m) => m.statistics.max).filter((v) => v != null);

    const allFPoints = [];
    let outOfBandEvents = 0;
    perMeter.forEach((m) => {
      const fPoints = m.points.map((p) => ({ value: p.value, timestamp: p.timestamp }));
      fPoints.forEach((p) => {
        if (p.value != null) allFPoints.push({ value: p.value });
      });
      outOfBandEvents += countRangeExcursionEvents(fPoints, {
        lower: FREQUENCY_BAND.lower,
        upper: FREQUENCY_BAND.upper,
        mode: 'under',
      });
      outOfBandEvents += countRangeExcursionEvents(fPoints, {
        lower: FREQUENCY_BAND.lower,
        upper: FREQUENCY_BAND.upper,
        mode: 'over',
      });
    });

    const healthyPercent = computeTimeInRangePercent(
      allFPoints,
      FREQUENCY_BAND.lower,
      FREQUENCY_BAND.upper
    );

    summary = {
      fleetAverageFrequency: averageFinite(currents, 2),
      fleetMinFrequency: mins.length ? Math.min(...mins) : null,
      fleetMaxFrequency: maxs.length ? Math.max(...maxs) : null,
      healthScore: computeFleetHealthScore('frequency', {
        timeInRangePercent: healthyPercent,
      }),
      healthyBandPercent: healthyPercent,
    };

    insights.outOfBandEventCount = outOfBandEvents;

    const unstableItems = perMeter.map((m) => ({
      meterId: m.meterId,
      machineName: m.machineName,
      siteName: m.siteName,
      value: m.statistics.variation,
      unit: 'Hz',
    }));
    rankings.mostUnstableFrequency = buildRankingRows(unstableItems, 'value', 'Hz', RANKING_LIMIT);
  }

  return {
    scope: 'fleet',
    metric: metricKey,
    range: history.range,
    timezone: 'Asia/Kolkata',
    meterCount: meters.length,
    onlineMeterCount: fleetSnapshot.onlineMeterCount,
    fleetSnapshot: {
      reportingMeterCount: fleetSnapshot.reportingMeterCount,
      totalMeterCount: fleetSnapshot.totalMeterCount,
      lastUpdated: fleetSnapshot.lastUpdated,
    },
    config: getDefaultInsightsConfig(),
    label: metricDef.label,
    unit: metricDef.unit,
    decimals: metricDef.decimals,
    summary,
    comparisons: {},
    charts: {
      chartSeries: history.chartSeries,
      referenceLines: buildReferenceLines(metricKey, history),
      dataStart: history.dataStart,
      dataEnd: history.dataEnd,
      requestedSince: history.requestedSince,
      requestedUntil: history.requestedUntil,
    },
    insights,
    rankings,
  };
}

module.exports = {
  buildFleetMetricInsights,
};
