const { fetchVisibleLogsInRange } = require('./electricalHealthService');
const { buildReadings, pickReadingValue, roundToDecimals } = require('./energyMeterUtils');

const PARAMETER_KEYS = ['voltage', 'current', 'activePower', 'energy', 'powerFactor', 'frequency'];

const PARAMETER_DECIMALS = {
  voltage: 1,
  current: 2,
  activePower: 2,
  energy: 2,
  powerFactor: 2,
  frequency: 2,
};

function extractReadingValue(log, key) {
  let readings = log.readings;
  if (!readings || !Object.keys(readings).length) {
    readings = buildReadings(log.rawValues || [], []);
  }
  return pickReadingValue(readings, key);
}

function buildMinMaxStats(values, decimals) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {
    min: roundToDecimals(min, decimals),
    max: roundToDecimals(max, decimals),
  };
}

async function buildMeterParameterStats24h(device) {
  const { rangeKey, requestedSince, requestedUntil, logs } = await fetchVisibleLogsInRange(
    [device],
    '24h'
  );

  const stats = {};

  PARAMETER_KEYS.forEach((key) => {
    const decimals = PARAMETER_DECIMALS[key] ?? 2;
    const values = [];

    logs.forEach((log) => {
      const value = extractReadingValue(log, key);
      if (value != null && Number.isFinite(Number(value))) {
        values.push(Number(value));
      }
    });

    const minMax = buildMinMaxStats(values, decimals);
    if (minMax) stats[key] = minMax;
  });

  return {
    range: rangeKey,
    requestedSince,
    requestedUntil,
    stats,
  };
}

module.exports = {
  PARAMETER_KEYS,
  buildMeterParameterStats24h,
};
