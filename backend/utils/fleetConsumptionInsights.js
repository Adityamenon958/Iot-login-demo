const EnergyMeterLog = require('../models/EnergyMeterLog');
const {
  buildLogFilterForMeters,
  buildReadings,
  pickReadingValue,
  isMeterOnline,
} = require('./energyMeterUtils');
const {
  CONSUMPTION_PERIOD_DAYS,
  roundTo,
  getTodayStartIstUtc,
  getYesterdayStartIstUtc,
  getWeekStartIstUtc,
  getPreviousWeekStartIstUtc,
  getMonthStartIstUtc,
  getPreviousMonthStartIstUtc,
  getDaysInMonthIst,
  getDaysElapsedInMonthIst,
  buildComparison,
  bucketLogsByIstDate,
  sumDailyKwhInRange,
  computePeakUsageHourToday,
  buildHourlyConsumptionToday,
  projectMonthEndKwh,
  getDefaultInsightsConfig,
  istStartUtcFromYMD,
  buildRankingRows,
} = require('./meterInsightsUtils');

const RANKING_LIMIT = 5;

function extractEnergy(log) {
  let readings = log.readings;
  if (!readings || !Object.keys(readings).length) {
    readings = buildReadings(log.rawValues || [], []);
  }
  return pickReadingValue(readings, 'energy');
}

function findHighestLowestDay(dailyBreakdown) {
  if (!dailyBreakdown?.length) return { highestDay: null, lowestDay: null };
  let highest = dailyBreakdown[0];
  let lowest = dailyBreakdown[0];
  dailyBreakdown.forEach((d) => {
    if (d.kwh > highest.kwh) highest = d;
    if (d.kwh < lowest.kwh) lowest = d;
  });
  return {
    highestDay: { date: highest.date, kwh: highest.kwh },
    lowestDay: { date: lowest.date, kwh: lowest.kwh },
  };
}

function mergeFleetDaily(meterDailyMaps) {
  const fleetMap = new Map();
  meterDailyMaps.forEach((daily) => {
    daily.forEach((d) => {
      const prev = fleetMap.get(d.date) || 0;
      fleetMap.set(d.date, roundTo(prev + d.kwh, 2));
    });
  });
  return Array.from(fleetMap.entries())
    .map(([date, kwh]) => ({ date, kwh }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function buildFleetConsumptionInsights(meters, periodKey = '7d') {
  const period = Object.prototype.hasOwnProperty.call(CONSUMPTION_PERIOD_DAYS, periodKey)
    ? periodKey
    : '7d';
  const periodDays = CONSUMPTION_PERIOD_DAYS[period];
  const now = new Date();
  const timezone = 'Asia/Kolkata';
  const totalMeterCount = meters.length;

  const todayStart = getTodayStartIstUtc(now);
  const yesterdayStart = getYesterdayStartIstUtc(now);
  const weekStart = getWeekStartIstUtc(now);
  const prevWeekStart = getPreviousWeekStartIstUtc(now);
  const monthStart = getMonthStartIstUtc(now);
  const prevMonthStart = getPreviousMonthStartIstUtc(now);
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const fetchSince = new Date(Math.min(periodStart.getTime(), prevMonthStart.getTime()));

  const empty = {
    scope: 'fleet',
    metric: 'energy',
    period,
    timezone,
    meterCount: totalMeterCount,
    onlineMeterCount: 0,
    fleetSnapshot: {
      reportingMeterCount: 0,
      totalMeterCount,
      lastUpdated: null,
    },
    config: getDefaultInsightsConfig(),
    summary: {},
    comparisons: {},
    charts: { dailyBreakdown: [], hourlyBreakdownToday: [] },
    insights: {},
    rankings: {},
  };

  if (!meters.length) return empty;

  const logFilter = await buildLogFilterForMeters(meters, {
    timestamp: { $gte: fetchSince },
    'readings.energy': { $exists: true, $ne: null },
  });

  const logs = await EnergyMeterLog.find(logFilter).sort({ timestamp: 1 }).lean();
  if (!logs.length) return empty;

  const byMeter = {};
  let lastUpdated = null;
  logs.forEach((log) => {
    if (!byMeter[log.meterId]) byMeter[log.meterId] = [];
    byMeter[log.meterId].push(log);
    if (!lastUpdated || new Date(log.timestamp) > new Date(lastUpdated)) {
      lastUpdated = log.timestamp;
    }
  });

  const meterMeta = {};
  meters.forEach((m) => {
    meterMeta[m.deviceId] = {
      machineName: m.machineName || '',
      siteName: m.siteName || '',
    };
  });

  const reportingMeterCount = Object.keys(byMeter).length;
  const meterDailyMaps = [];
  const meterTodayKwh = [];
  const meterMonthKwh = [];

  Object.entries(byMeter).forEach(([meterId, meterLogs]) => {
    const dailyAll = bucketLogsByIstDate(meterLogs, extractEnergy);
    meterDailyMaps.push(dailyAll);

    const todayKwh = sumDailyKwhInRange(dailyAll, todayStart, now);
    const monthKwh = sumDailyKwhInRange(dailyAll, monthStart, now);
    const meta = meterMeta[meterId] || {};

    meterTodayKwh.push({
      meterId,
      machineName: meta.machineName,
      siteName: meta.siteName,
      value: roundTo(todayKwh, 2),
      unit: 'kWh',
    });
    meterMonthKwh.push({
      meterId,
      machineName: meta.machineName,
      siteName: meta.siteName,
      value: roundTo(monthKwh, 2),
      unit: 'kWh',
    });
  });

  const fleetDaily = mergeFleetDaily(meterDailyMaps);
  const fleetDailyInPeriod = fleetDaily.filter((d) => {
    const dayStart = istStartUtcFromYMD(
      Number(d.date.slice(0, 4)),
      Number(d.date.slice(5, 7)) - 1,
      Number(d.date.slice(8, 10))
    );
    return dayStart >= periodStart;
  });

  const todayKwh = meterTodayKwh.reduce((s, m) => s + (m.value || 0), 0);
  const yesterdayKwh = sumDailyKwhInRange(fleetDaily, yesterdayStart, todayStart);
  const weekKwh = sumDailyKwhInRange(fleetDaily, weekStart, now);
  const prevWeekKwh = sumDailyKwhInRange(fleetDaily, prevWeekStart, weekStart);
  const monthKwh = meterMonthKwh.reduce((s, m) => s + (m.value || 0), 0);
  const prevMonthKwh = sumDailyKwhInRange(fleetDaily, prevMonthStart, monthStart);

  const periodTotalKwh = fleetDailyInPeriod.reduce((s, d) => s + d.kwh, 0);
  const daysWithData = fleetDailyInPeriod.filter((d) => d.kwh > 0).length || fleetDailyInPeriod.length;
  const avgDailyKwh = daysWithData > 0 ? roundTo(periodTotalKwh / daysWithData, 2) : null;

  const daysElapsed = getDaysElapsedInMonthIst(now);
  const daysInMonth = getDaysInMonthIst(now);
  const projectedMonthEndKwh = projectMonthEndKwh(monthKwh, daysElapsed, daysInMonth);

  const { highestDay, lowestDay } = findHighestLowestDay(fleetDailyInPeriod);
  const peakUsageHourToday = computePeakUsageHourToday(logs, extractEnergy, todayStart);
  const hourlyBreakdownToday = buildHourlyConsumptionToday(logs, extractEnergy, todayStart);

  const onlineMeterCount = meters.filter((m) => {
    const meterLogs = byMeter[m.deviceId];
    if (!meterLogs?.length) return false;
    return isMeterOnline(meterLogs[meterLogs.length - 1].timestamp);
  }).length;

  return {
    scope: 'fleet',
    metric: 'energy',
    period,
    timezone,
    meterCount: totalMeterCount,
    onlineMeterCount,
    fleetSnapshot: {
      reportingMeterCount,
      totalMeterCount,
      lastUpdated,
    },
    config: getDefaultInsightsConfig(),
    summary: {
      todayKwh: roundTo(todayKwh, 2),
      yesterdayKwh: roundTo(yesterdayKwh, 2),
      weekKwh: roundTo(weekKwh, 2),
      monthKwh: roundTo(monthKwh, 2),
      periodTotalKwh: roundTo(periodTotalKwh, 2),
      avgDailyKwh,
      projectedMonthEndKwh,
    },
    comparisons: {
      todayVsYesterday: buildComparison(todayKwh, yesterdayKwh),
      weekVsPreviousWeek: buildComparison(weekKwh, prevWeekKwh),
      monthVsPreviousMonth: buildComparison(monthKwh, prevMonthKwh),
    },
    charts: {
      dailyBreakdown: fleetDailyInPeriod,
      hourlyBreakdownToday,
    },
    insights: {
      peakUsageHourToday,
      highestDay,
      lowestDay: period === '30d' ? lowestDay : null,
    },
    rankings: {
      topConsumersToday: buildRankingRows(meterTodayKwh, 'value', 'kWh', RANKING_LIMIT),
      topConsumersThisMonth: buildRankingRows(meterMonthKwh, 'value', 'kWh', RANKING_LIMIT),
    },
  };
}

module.exports = {
  buildFleetConsumptionInsights,
};
