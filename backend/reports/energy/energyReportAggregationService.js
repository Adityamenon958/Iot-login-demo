const EnergyMeterLog = require('../../models/EnergyMeterLog');
const {
  buildLogFilterForMeters,
  buildReadings,
  pickReadingValue,
  isMeterOnline,
} = require('../../utils/energyMeterUtils');
const {
  roundTo,
  bucketLogsByIstDate,
  mergeFleetDailyWithBreakdown,
  sumDailyKwhInRange,
  buildComparison,
  VOLTAGE_BAND,
  formatIstDateKey,
} = require('../../utils/meterInsightsUtils');
const { buildFleetLoadProfile, emptyLoadProfile } = require('./energyLoadProfileService');

const NOMINAL_VOLTAGE = 230;
const READING_KEYS = ['voltage', 'current', 'activePower', 'powerFactor', 'frequency', 'energy'];

function extractEnergy(log) {
  let readings = log.readings;
  if (!readings || !Object.keys(readings).length) {
    readings = buildReadings(log.rawValues || [], []);
  }
  return pickReadingValue(readings, 'energy');
}

function extractReading(log, key) {
  let readings = log.readings;
  if (!readings || !Object.keys(readings).length) {
    readings = buildReadings(log.rawValues || [], []);
  }
  return pickReadingValue(readings, key);
}

function avgOf(values) {
  const nums = values.filter((v) => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  return roundTo(nums.reduce((s, v) => s + v, 0) / nums.length, 2);
}

function maxOf(values) {
  const nums = values.filter((v) => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  return roundTo(Math.max(...nums), 2);
}

function bucketFleetTrendByDate(logs, key, from, to) {
  const buckets = new Map();
  logs.forEach((log) => {
    const ts = new Date(log.timestamp);
    if (ts < from || ts > to) return;
    const val = extractReading(log, key);
    if (val == null || !Number.isFinite(val)) return;
    const dateKey = formatIstDateKey(log.timestamp);
    if (!buckets.has(dateKey)) buckets.set(dateKey, []);
    buckets.get(dateKey).push(val);
  });
  return Array.from(buckets.entries())
    .map(([date, vals]) => ({
      date,
      value: avgOf(vals),
      max: maxOf(vals),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function resolveCommunicationStatus(lastTimestamp) {
  const online = lastTimestamp ? isMeterOnline(lastTimestamp) : false;
  const offlineHours =
    lastTimestamp && !online
      ? roundTo(
          Math.max(0, (Date.now() - new Date(lastTimestamp).getTime()) / (60 * 60 * 1000)),
          1
        )
      : online
        ? 0
        : null;
  return { online, lastCommunication: lastTimestamp || null, offlineHours };
}

/** Latest log per meter (current comms status), independent of report period window. */
async function fetchLatestCommunicationByMeter(meters) {
  if (!meters.length) return {};

  const logFilter = await buildLogFilterForMeters(meters, {});
  const rows = await EnergyMeterLog.aggregate([
    { $match: logFilter },
    { $group: { _id: '$meterId', lastTimestamp: { $max: '$timestamp' } } },
  ]);

  const latestByMeterId = {};
  rows.forEach((row) => {
    latestByMeterId[row._id] = row.lastTimestamp;
  });
  return latestByMeterId;
}

async function aggregateReportData(meters, period) {
  const { from, to, compareFrom, compareTo, periodDays } = period;
  const meterMeta = {};
  meters.forEach((m) => {
    meterMeta[m.deviceId] = {
      meterId: m.deviceId,
      machineName: m.machineName || m.deviceId,
      siteName: m.siteName || '',
      plantName: m.plantName || '',
    };
  });

  const emptyResult = {
    fleetSummary: {
      totalEnergyKwh: 0,
      avgActivePowerKw: null,
      peakActivePowerKw: null,
      peakActivePowerAt: null,
      peakActivePowerMeterId: null,
      avgVoltage: null,
      avgCurrent: null,
      avgPowerFactor: null,
      avgFrequency: null,
      onlineMeters: 0,
      offlineMeters: meters.length,
    },
    comparisons: { previousPeriod: {} },
    dailyBreakdown: [],
    energyByMeter: [],
    trendSeries: { energy: [], activePower: [], powerFactor: [] },
    loadProfile: emptyLoadProfile(),
    meters: [],
    periodDays,
  };

  if (!meters.length) return emptyResult;

  const latestCommunicationByMeter = await fetchLatestCommunicationByMeter(meters);

  const fetchFrom = compareFrom < from ? compareFrom : from;
  const logFilter = await buildLogFilterForMeters(meters, {
    timestamp: { $gte: fetchFrom, $lte: to },
  });

  const logs = await EnergyMeterLog.find(logFilter).sort({ timestamp: 1 }).lean();
  const logsByMeter = {};
  logs.forEach((log) => {
    if (!logsByMeter[log.meterId]) logsByMeter[log.meterId] = [];
    logsByMeter[log.meterId].push(log);
  });

  const meterDailyEntries = [];
  const meterRows = [];
  let fleetPeakPower = { value: null, at: null, meterId: null };
  const fleetPowerSamples = [];
  const fleetVoltageSamples = [];
  const fleetCurrentSamples = [];
  const fleetPfSamples = [];
  const fleetFreqSamples = [];

  Object.entries(logsByMeter).forEach(([meterId, meterLogs]) => {
    const meta = meterMeta[meterId] || { meterId, machineName: meterId, siteName: '' };
    const periodLogs = meterLogs.filter((l) => {
      const ts = new Date(l.timestamp);
      return ts >= from && ts <= to;
    });

    const dailyAll = bucketLogsByIstDate(meterLogs, extractEnergy);
    const totalEnergyKwh = sumDailyKwhInRange(dailyAll, from, to);
    meterDailyEntries.push({ meterId, machineName: meta.machineName, daily: dailyAll });

    const powerVals = [];
    const voltageVals = [];
    const currentVals = [];
    const pfVals = [];
    const freqVals = [];
    let peakPowerKw = null;
    let peakPowerAt = null;

    periodLogs.forEach((log) => {
      const p = extractReading(log, 'activePower');
      const v = extractReading(log, 'voltage');
      const c = extractReading(log, 'current');
      const pf = extractReading(log, 'powerFactor');
      const f = extractReading(log, 'frequency');
      if (p != null && Number.isFinite(p)) {
        powerVals.push(p);
        fleetPowerSamples.push(p);
        if (peakPowerKw == null || p > peakPowerKw) {
          peakPowerKw = p;
          peakPowerAt = log.timestamp;
        }
        if (fleetPeakPower.value == null || p > fleetPeakPower.value) {
          fleetPeakPower = { value: p, at: log.timestamp, meterId };
        }
      }
      if (v != null && Number.isFinite(v)) {
        voltageVals.push(v);
        fleetVoltageSamples.push(v);
      }
      if (c != null && Number.isFinite(c)) {
        currentVals.push(c);
        fleetCurrentSamples.push(c);
      }
      if (pf != null && Number.isFinite(pf)) {
        pfVals.push(pf);
        fleetPfSamples.push(pf);
      }
      if (f != null && Number.isFinite(f)) {
        freqVals.push(f);
        fleetFreqSamples.push(f);
      }
    });

    const lastTs = latestCommunicationByMeter[meterId] || null;
    const { online, lastCommunication, offlineHours } = resolveCommunicationStatus(lastTs);

    const avgVoltage = avgOf(voltageVals);
    const voltageDeviation = avgVoltage != null ? Math.abs(avgVoltage - NOMINAL_VOLTAGE) : null;

    meterRows.push({
      meterId,
      machineName: meta.machineName,
      siteName: meta.siteName,
      online,
      lastCommunication,
      offlineHours,
      totalEnergyKwh: roundTo(totalEnergyKwh, 2),
      peakPowerKw: peakPowerKw != null ? roundTo(peakPowerKw, 2) : null,
      peakPowerAt,
      avgVoltage,
      avgCurrent: avgOf(currentVals),
      avgPowerFactor: avgOf(pfVals),
      avgFrequency: avgOf(freqVals),
      voltageDeviation,
      alarmCount: 0,
      criticalAlarms: 0,
      warningAlarms: 0,
    });
  });

  meters.forEach((m) => {
    if (!meterRows.find((r) => r.meterId === m.deviceId)) {
      const { online, lastCommunication, offlineHours } = resolveCommunicationStatus(
        latestCommunicationByMeter[m.deviceId] || null
      );
      meterRows.push({
        meterId: m.deviceId,
        machineName: m.machineName || m.deviceId,
        siteName: m.siteName || '',
        online,
        lastCommunication,
        offlineHours,
        totalEnergyKwh: 0,
        peakPowerKw: null,
        peakPowerAt: null,
        avgVoltage: null,
        avgCurrent: null,
        avgPowerFactor: null,
        avgFrequency: null,
        voltageDeviation: null,
        alarmCount: 0,
        criticalAlarms: 0,
        warningAlarms: 0,
      });
    }
  });

  const dailyBreakdown = mergeFleetDailyWithBreakdown(meterDailyEntries).filter((d) => {
    const dayStart = new Date(`${d.date}T00:00:00+05:30`);
    return dayStart >= from && dayStart <= to;
  });

  const totalEnergyKwh = dailyBreakdown.reduce((s, d) => s + (d.kwh || 0), 0);
  const fleetDaily = mergeFleetDailyWithBreakdown(meterDailyEntries);
  const prevTotalEnergy = sumDailyKwhInRange(
    fleetDaily.map((d) => ({ date: d.date, kwh: d.kwh })),
    compareFrom,
    compareTo
  );

  const periodLogs = logs.filter((l) => {
    const ts = new Date(l.timestamp);
    return ts >= from && ts <= to;
  });

  const energyByMeter = meterRows
    .filter((m) => m.totalEnergyKwh > 0)
    .map((m) => ({
      meterId: m.meterId,
      machineName: m.machineName,
      kwh: m.totalEnergyKwh,
      sharePct: totalEnergyKwh > 0 ? roundTo((m.totalEnergyKwh / totalEnergyKwh) * 100, 1) : 0,
    }))
    .sort((a, b) => b.kwh - a.kwh);

  const onlineMeters = meterRows.filter((m) => m.online).length;
  const loadProfile = await buildFleetLoadProfile(meters, period);

  return {
    fleetSummary: {
      totalEnergyKwh: roundTo(totalEnergyKwh, 2),
      avgActivePowerKw: avgOf(fleetPowerSamples),
      peakActivePowerKw: fleetPeakPower.value != null ? roundTo(fleetPeakPower.value, 2) : null,
      peakActivePowerAt: fleetPeakPower.at,
      peakActivePowerMeterId: fleetPeakPower.meterId,
      avgVoltage: avgOf(fleetVoltageSamples),
      avgCurrent: avgOf(fleetCurrentSamples),
      avgPowerFactor: avgOf(fleetPfSamples),
      avgFrequency: avgOf(fleetFreqSamples),
      onlineMeters,
      offlineMeters: meters.length - onlineMeters,
      voltageBand: VOLTAGE_BAND,
    },
    comparisons: {
      previousPeriod: {
        totalEnergyKwh: buildComparison(totalEnergyKwh, prevTotalEnergy),
        peakActivePowerKw: buildComparison(
          fleetPeakPower.value,
          null
        ),
        avgPowerFactor: buildComparison(avgOf(fleetPfSamples), null),
      },
    },
    dailyBreakdown,
    energyByMeter,
    trendSeries: {
      energy: dailyBreakdown.map((d) => ({ date: d.date, value: d.kwh })),
      activePower: bucketFleetTrendByDate(periodLogs, 'activePower', from, to).map((b) => ({
        date: b.date,
        value: b.max,
      })),
      powerFactor: bucketFleetTrendByDate(periodLogs, 'powerFactor', from, to),
    },
    loadProfile,
    meters: meterRows,
    periodDays,
  };
}

module.exports = { aggregateReportData, NOMINAL_VOLTAGE };
