const EnergyMeterLog = require('../models/EnergyMeterLog');
const { buildLogFilterForCompany, buildReadings, pickReadingValue } = require('./energyMeterUtils');
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
} = require('./meterInsightsUtils');

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

async function buildMeterConsumptionInsights(device, periodKey = '7d') {
  const meterId = device.deviceId;
  const period = Object.prototype.hasOwnProperty.call(CONSUMPTION_PERIOD_DAYS, periodKey)
    ? periodKey
    : '7d';
  const periodDays = CONSUMPTION_PERIOD_DAYS[period];
  const now = new Date();
  const timezone = 'Asia/Kolkata';

  const todayStart = getTodayStartIstUtc(now);
  const yesterdayStart = getYesterdayStartIstUtc(now);
  const weekStart = getWeekStartIstUtc(now);
  const prevWeekStart = getPreviousWeekStartIstUtc(now);
  const monthStart = getMonthStartIstUtc(now);
  const prevMonthStart = getPreviousMonthStartIstUtc(now);

  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const fetchSince = new Date(Math.min(periodStart.getTime(), prevMonthStart.getTime()));

  const logFilter = await buildLogFilterForCompany(device.companyName, {
    meterId,
    timestamp: { $gte: fetchSince },
    'readings.energy': { $exists: true, $ne: null },
  });

  const logs = await EnergyMeterLog.find(logFilter).sort({ timestamp: 1 }).lean();

  const empty = {
    meterId,
    metric: 'energy',
    period,
    timezone,
    config: getDefaultInsightsConfig(),
    summary: {},
    comparisons: {},
    charts: { dailyBreakdown: [], hourlyBreakdownToday: [] },
    insights: {},
  };

  if (!logs.length) return empty;

  const dailyAll = bucketLogsByIstDate(logs, extractEnergy);
  const dailyInPeriod = dailyAll.filter((d) => {
    const dayStart = istStartUtcFromYMD(
      Number(d.date.slice(0, 4)),
      Number(d.date.slice(5, 7)) - 1,
      Number(d.date.slice(8, 10))
    );
    return dayStart >= periodStart;
  });

  const todayKwh = sumDailyKwhInRange(dailyAll, todayStart, now);
  const yesterdayKwh = sumDailyKwhInRange(dailyAll, yesterdayStart, todayStart);
  const weekKwh = sumDailyKwhInRange(dailyAll, weekStart, now);
  const prevWeekKwh = sumDailyKwhInRange(
    dailyAll,
    prevWeekStart,
    weekStart
  );
  const monthKwh = sumDailyKwhInRange(dailyAll, monthStart, now);
  const prevMonthEnd = monthStart;
  const prevMonthKwh = sumDailyKwhInRange(dailyAll, prevMonthStart, prevMonthEnd);

  const periodTotalKwh = dailyInPeriod.reduce((s, d) => s + d.kwh, 0);
  const daysWithData = dailyInPeriod.filter((d) => d.kwh > 0).length || dailyInPeriod.length;
  const avgDailyKwh = daysWithData > 0 ? roundTo(periodTotalKwh / daysWithData, 2) : null;

  const lastEnergy = extractEnergy(logs[logs.length - 1]);
  const { highestDay, lowestDay } = findHighestLowestDay(dailyInPeriod);

  const daysElapsed = getDaysElapsedInMonthIst(now);
  const daysInMonth = getDaysInMonthIst(now);
  const projectedMonthEndKwh = projectMonthEndKwh(monthKwh, daysElapsed, daysInMonth);

  const peakUsageHourToday = computePeakUsageHourToday(logs, extractEnergy, todayStart);
  const hourlyBreakdownToday = buildHourlyConsumptionToday(logs, extractEnergy, todayStart);

  const minimalUsageDays = dailyInPeriod.filter((d) => d.kwh < 0.01).length;

  return {
    meterId,
    metric: 'energy',
    period,
    timezone,
    config: getDefaultInsightsConfig(),
    summary: {
      todayKwh: roundTo(todayKwh, 2),
      yesterdayKwh: roundTo(yesterdayKwh, 2),
      weekKwh: roundTo(weekKwh, 2),
      monthKwh: roundTo(monthKwh, 2),
      periodTotalKwh: roundTo(periodTotalKwh, 2),
      avgDailyKwh,
      cumulativeRegisterKwh: lastEnergy != null ? roundTo(lastEnergy, 2) : null,
      projectedMonthEndKwh,
    },
    comparisons: {
      todayVsYesterday: buildComparison(todayKwh, yesterdayKwh),
      weekVsPreviousWeek: buildComparison(weekKwh, prevWeekKwh),
      monthVsPreviousMonth: buildComparison(monthKwh, prevMonthKwh),
    },
    charts: {
      dailyBreakdown: dailyInPeriod,
      hourlyBreakdownToday,
    },
    insights: {
      peakUsageHourToday,
      projectedMonthEndKwh,
      highestDay,
      lowestDay: period === '30d' ? lowestDay : null,
      minimalUsageDays,
    },
  };
}

module.exports = {
  buildMeterConsumptionInsights,
};
