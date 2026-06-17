const { DEFAULT_PARAMETERS } = require('./energyMeterUtils');
const { computeSimulatedLoad, MACHINE_PROFILE_TO_APPLIANCE } = require('./energyApplianceCatalog');

const VALID_INTERVALS_SECONDS = [30, 60, 120, 180, 300];

const MIN_PF = 0.7;
const GRID_FREQ_NOMINAL = 50.0;
const GRID_FREQ_MIN = 49.8;
const GRID_FREQ_MAX = 50.2;

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatEnergyMeterDate(d = new Date()) {
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

function round(value, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toRaw(value, scale) {
  return Math.round(Number(value) / scale);
}

function normalizeSimDevice(device) {
  const d = { ...device };
  if (!d.energySimMode) {
    d.energySimMode = 'single';
    if (!d.singleApplianceType && d.machineProfile) {
      d.singleApplianceType = MACHINE_PROFILE_TO_APPLIANCE[d.machineProfile] || 'ac_split';
    }
  }
  if (d.minVoltage == null) d.minVoltage = 220;
  if (d.maxVoltage == null) d.maxVoltage = 240;
  if (d.occupancyPercent == null) d.occupancyPercent = 100;
  if (!d.roomType) d.roomType = 'office';
  return d;
}

function generateGridFrequency(jitter) {
  const slow = Math.sin((Date.now() % 300000) / 300000 * Math.PI * 2) * 0.05;
  let hz = GRID_FREQ_NOMINAL + slow + (jitter ? randBetween(-0.12, 0.12) : 0);
  return round(clamp(hz, GRID_FREQ_MIN, GRID_FREQ_MAX), 2);
}

function generateVoltage(simDevice, totalKw, jitter) {
  const minV = Number(simDevice.minVoltage) || 220;
  const maxV = Number(simDevice.maxVoltage) || 240;
  let voltage = 230 + (jitter ? randBetween(-1.5, 1.5) : 0);
  if (totalKw > 5) {
    const sag = Math.min(0.02, (totalKw - 5) * 0.002);
    voltage *= 1 - sag;
  }
  return round(clamp(voltage, minV, maxV), 1);
}

/**
 * Industrial physics engine — 6-parameter readings.
 */
function generateElectricalReadings(simDevice, options = {}) {
  const { advanceEnergy = true, now = new Date() } = options;
  const device = normalizeSimDevice(simDevice);
  const jitter = device.jitter !== false;
  const intervalSec = Number(device.intervalSeconds) || 60;

  const load = computeSimulatedLoad(device, now);
  const activePowerKw = load.totalKw;
  const powerFactor = load.powerFactor;

  let energyKwh = device.energyBaseReading != null ? Number(device.energyBaseReading) : 0;
  if (advanceEnergy && activePowerKw > 0) {
    energyKwh = round(energyKwh + activePowerKw * (intervalSec / 3600), 2);
  }

  const voltage = generateVoltage(device, activePowerKw, jitter);
  const frequency = generateGridFrequency(jitter);
  const pfSafe = Math.max(powerFactor, MIN_PF);

  let current = activePowerKw > 0
    ? (activePowerKw * 1000) / (voltage * pfSafe)
    : 0;
  if (jitter && current > 0) current += randBetween(-0.3, 0.3);
  current = round(Math.max(0, current), 2);

  return {
    readings: {
      voltage,
      current,
      activePower: round(activePowerKw, 2),
      energy: energyKwh,
      powerFactor,
      frequency,
    },
    breakdown: {
      totalKw: activePowerKw,
      powerFactor,
      frequency,
      items: load.items,
      scheduleFactor: load.scheduleFactor,
      occupancyFactor: load.occupancyFactor,
    },
    energyKwh,
  };
}

function readingsToRawValues(readings, parameters = DEFAULT_PARAMETERS) {
  return parameters.map((param) => {
    const value = readings[param.key];
    if (value == null) return 0;
    return toRaw(value, param.scale ?? 1);
  });
}

/**
 * Build webhook payload:
 * { "Energy Meter_1": "DD/MM/YYYY HH:mm:ss,[V,A,kW,kWh,PF,Hz]" }
 */
function buildEnergyMeterPayload(device, options = {}) {
  const { advanceReading = true, now = new Date() } = options;
  const { readings, breakdown, energyKwh } = generateElectricalReadings(device, {
    advanceEnergy: advanceReading,
    now,
  });

  const rawValues = readingsToRawValues(readings);
  const dateStr = formatEnergyMeterDate(now);
  const meterKey = device.deviceId;

  return {
    payload: {
      [meterKey]: `${dateStr},[${rawValues.join(',')}]`,
    },
    readings,
    rawValues,
    energyKwh,
    breakdown,
    dateStr,
  };
}

function buildUidFromCompany(companyName, deviceId) {
  const prefix = String(companyName || 'GS')
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase() || 'GS';
  return `${prefix}-${deviceId}`;
}

/** @deprecated use energyApplianceCatalog */
function getProfileConfig(profileName) {
  return { baseEnergyKwh: 0, pattern: 'flat', powerKwRange: [1, 3], voltageRange: [228, 232], energyDriftKwh: 0.06 };
}

module.exports = {
  VALID_INTERVALS_SECONDS,
  formatEnergyMeterDate,
  getProfileConfig,
  generateElectricalReadings,
  readingsToRawValues,
  buildEnergyMeterPayload,
  buildUidFromCompany,
  normalizeSimDevice,
};
