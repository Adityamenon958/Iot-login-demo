const EnergyMeterLog = require('../models/EnergyMeterLog');
const {
  parseChartRange,
  isMeterOnline,
  formatRelativeTime,
  buildLogFilterForMeters,
} = require('./energyMeterUtils');
const {
  fetchVisibleLogsInRange,
  buildChartSeriesForMetric,
} = require('./electricalHealthService');
const {
  getMetricDefinition,
  evaluateMeterStatus,
  worstStatus,
} = require('./electricalHealthMetrics');

const STALE_COMMUNICATION_MS = 30 * 60 * 1000;
const FLEET_TABLE_RANGES = ['24h', '7d', '30d'];
const TABLE_METRIC_KEYS = ['activePower', 'voltage', 'current', 'powerFactor', 'frequency'];
const HEALTH_METRIC_KEYS = ['voltage', 'powerFactor', 'frequency'];

function parseFleetTableRange(rangeKey) {
  const key = FLEET_TABLE_RANGES.includes(rangeKey) ? rangeKey : '24h';
  return parseChartRange(key);
}

function resolveCommunicationState(lastTimestamp) {
  if (!lastTimestamp) {
    return {
      communicationState: 'never_reported',
      online: false,
      statusLabel: 'Never Reported',
    };
  }

  const online = isMeterOnline(lastTimestamp);
  if (online) {
    return { communicationState: 'live', online: true, statusLabel: 'Online' };
  }

  const ageMs = Date.now() - new Date(lastTimestamp).getTime();
  if (ageMs >= STALE_COMMUNICATION_MS) {
    return { communicationState: 'stale', online: false, statusLabel: 'Offline (Stale)' };
  }

  return { communicationState: 'silent', online: false, statusLabel: 'Offline (Silent)' };
}

function computeMeterHealth(statusByMetric) {
  let health = 'unknown';
  HEALTH_METRIC_KEYS.forEach((key) => {
    const status = statusByMetric[key];
    if (!status || status === 'unknown') return;
    health = health === 'unknown' ? status : worstStatus(health, status);
  });
  return health;
}

function assignDenseRanks(rows, getValue) {
  const ranked = rows
    .map((row) => ({ meterId: row.meterId, value: getValue(row) }))
    .filter((item) => item.value != null && Number.isFinite(Number(item.value)))
    .sort((a, b) => Number(b.value) - Number(a.value));

  const rankMap = new Map();
  let rank = 0;
  let lastValue = null;

  ranked.forEach(({ meterId, value }) => {
    const num = Number(value);
    if (lastValue === null || num !== lastValue) {
      rank += 1;
      lastValue = num;
    }
    rankMap.set(meterId, rank);
  });

  return rankMap;
}

async function fetchLatestTimestampByMeter(meters) {
  const map = new Map();
  if (!meters?.length) return map;

  const logFilter = await buildLogFilterForMeters(meters, {});
  const rows = await EnergyMeterLog.aggregate([
    { $match: logFilter },
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: '$meterId',
        lastTimestamp: { $first: '$timestamp' },
      },
    },
  ]);

  rows.forEach((row) => {
    if (row._id) map.set(row._id, row.lastTimestamp);
  });

  return map;
}

function seriesToMap(chartSeries) {
  const map = new Map();
  chartSeries.forEach((s) => map.set(s.meterId, s));
  return map;
}

async function buildFleetMetersTable(meters, rangeKey = '24h') {
  const { key } = parseFleetTableRange(rangeKey);
  const empty = {
    range: key,
    requestedSince: new Date(),
    requestedUntil: new Date(),
    config: { staleCommunicationMs: STALE_COMMUNICATION_MS },
    meterCount: 0,
    meters: [],
  };

  if (!meters?.length) return empty;

  const [{ requestedSince, requestedUntil, logs }, latestByMeter] = await Promise.all([
    fetchVisibleLogsInRange(meters, key),
    fetchLatestTimestampByMeter(meters),
  ]);

  const seriesByMetric = {};
  TABLE_METRIC_KEYS.forEach((metricKey) => {
    const metricDef = getMetricDefinition(metricKey);
    if (!metricDef) return;
    seriesByMetric[metricKey] = seriesToMap(
      buildChartSeriesForMetric(logs, metricKey, metricDef, key, requestedSince, 1)
    );
  });

  const rows = meters.map((device) => {
    const meterId = device.deviceId;
    const powerSeries = seriesByMetric.activePower?.get(meterId);
    const voltageSeries = seriesByMetric.voltage?.get(meterId);
    const currentSeries = seriesByMetric.current?.get(meterId);
    const pfSeries = seriesByMetric.powerFactor?.get(meterId);
    const freqSeries = seriesByMetric.frequency?.get(meterId);

    const powerStats = powerSeries?.statistics || {};
    const voltageDef = getMetricDefinition('voltage');
    const pfDef = getMetricDefinition('powerFactor');
    const freqDef = getMetricDefinition('frequency');

    const statusByMetric = {
      voltage: evaluateMeterStatus(voltageDef, voltageSeries?.statistics?.current),
      powerFactor: evaluateMeterStatus(pfDef, pfSeries?.statistics?.current),
      frequency: evaluateMeterStatus(freqDef, freqSeries?.statistics?.current),
    };

    const lastTimestamp =
      latestByMeter.get(meterId) ||
      powerSeries?.lastActiveAt ||
      voltageSeries?.lastActiveAt ||
      null;

    const comm = resolveCommunicationState(lastTimestamp);
    const healthStatus = computeMeterHealth(statusByMetric);

    return {
      meterId,
      machineName: device.machineName || '',
      siteName: device.siteName || '',
      plantName: device.plantName || '',
      uid: device.uid || '',
      online: comm.online,
      communicationState: comm.communicationState,
      statusLabel: comm.statusLabel,
      lastTimestamp,
      lastCommunication: formatRelativeTime(lastTimestamp),
      readings: {
        activePowerKw: powerStats.currentPower ?? null,
        peakPowerKw: powerStats.peakPower ?? null,
        energyKwh: powerStats.energyInRange ?? null,
        voltage: voltageSeries?.statistics?.current ?? null,
        current: currentSeries?.statistics?.current ?? null,
        powerFactor: pfSeries?.statistics?.current ?? null,
        frequency: freqSeries?.statistics?.current ?? null,
      },
      healthStatus,
      currentPowerRank: null,
      energyConsumptionRank: null,
    };
  });

  const powerRankMap = assignDenseRanks(rows, (r) => r.readings?.activePowerKw);
  const energyRankMap = assignDenseRanks(rows, (r) => r.readings?.energyKwh);

  rows.forEach((row) => {
    row.currentPowerRank = powerRankMap.get(row.meterId) ?? null;
    row.energyConsumptionRank = energyRankMap.get(row.meterId) ?? null;
  });

  return {
    range: key,
    requestedSince,
    requestedUntil,
    config: { staleCommunicationMs: STALE_COMMUNICATION_MS },
    meterCount: rows.length,
    meters: rows,
  };
}

module.exports = {
  STALE_COMMUNICATION_MS,
  FLEET_TABLE_RANGES,
  buildFleetMetersTable,
  resolveCommunicationState,
};
