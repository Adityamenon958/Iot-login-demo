const { DEFAULT_PARAMETERS } = require('./energyMeterUtils');

/**
 * Single-phase demo profiles — realistic load shapes per machine type.
 * Register mapping (index → parameter) lives in DEFAULT_PARAMETERS and can be changed later.
 */
const ENERGY_MACHINE_PROFILES = {
  warehouse: {
    label: 'Warehouse',
    siteName: 'Demo Warehouse',
    plantName: 'Storage Facility',
    machineName: 'Warehouse Line',
    baseEnergyKwh: 6200,
    voltageRange: [228, 232],
    powerKwRange: [1.8, 3.4],
    energyDriftKwh: 0.06,
    pattern: 'flat',
  },
  cnc: {
    label: 'CNC Machine',
    siteName: 'Manufacturing Plant',
    plantName: 'Production Hall',
    machineName: 'CNC Machine',
    baseEnergyKwh: 7100,
    voltageRange: [226, 234],
    powerKwRange: [4.5, 11.5],
    energyDriftKwh: 0.15,
    pattern: 'spike',
  },
  compressor: {
    label: 'Compressor',
    siteName: 'Utility Bay',
    plantName: 'Compressor Room',
    machineName: 'Air Compressor',
    baseEnergyKwh: 8400,
    voltageRange: [224, 233],
    powerKwRange: [2.8, 8.2],
    energyDriftKwh: 0.1,
    pattern: 'cyclic',
  },
  conveyor: {
    label: 'Conveyor',
    siteName: 'Assembly Plant',
    plantName: 'Packaging Unit',
    machineName: 'Conveyor Belt',
    baseEnergyKwh: 5800,
    voltageRange: [229, 231],
    powerKwRange: [1.1, 2.3],
    energyDriftKwh: 0.04,
    pattern: 'steady',
  },
};

const VALID_INTERVALS_SECONDS = [30, 60, 120, 180, 300];

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatEnergyMeterDate(d = new Date()) {
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function getProfileConfig(profileName) {
  return ENERGY_MACHINE_PROFILES[profileName] || ENERGY_MACHINE_PROFILES.warehouse;
}

function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

function round(value, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function stateLoadFactor(state) {
  if (state === 'maintenance') return 0.05;
  if (state === 'idle') return 0.25;
  return 1;
}

function patternPowerMultiplier(pattern, profile) {
  const base = randBetween(profile.powerKwRange[0], profile.powerKwRange[1]);
  if (pattern === 'spike') {
    return Math.random() > 0.65 ? base * randBetween(1.4, 1.9) : base * randBetween(0.5, 0.85);
  }
  if (pattern === 'cyclic') {
    const phase = Date.now() % 90000;
    const wave = Math.sin((phase / 90000) * Math.PI * 2);
    return base * (0.55 + (wave + 1) * 0.35);
  }
  if (pattern === 'steady') {
    return base * randBetween(0.92, 1.08);
  }
  return base * randBetween(0.9, 1.1);
}

function toRaw(value, scale) {
  return Math.round(Number(value) / scale);
}

/**
 * Generate realistic single-phase electrical readings (demo values).
 */
function generateElectricalReadings(device, profile, options = {}) {
  const { advanceEnergy = true } = options;
  const loadFactor = stateLoadFactor(device.state || 'working');
  const jitter = device.jitter !== false;

  let energyKwh = device.energyBaseReading != null
    ? Number(device.energyBaseReading)
    : profile.baseEnergyKwh;

  if (advanceEnergy) {
    const drift = profile.energyDriftKwh * loadFactor;
    energyKwh = round(energyKwh + drift + (jitter ? randBetween(-0.02, 0.04) : 0), 2);
  }

  let voltage = randBetween(profile.voltageRange[0], profile.voltageRange[1]);
  if (jitter) voltage += randBetween(-1.2, 1.2);
  voltage = round(Math.max(210, Math.min(245, voltage)), 1);

  let activePowerKw = patternPowerMultiplier(profile.pattern, profile) * loadFactor;
  if (jitter) activePowerKw += randBetween(-0.15, 0.15);
  activePowerKw = round(Math.max(0.05, activePowerKw), 2);

  // I ≈ P / V (single-phase, kW → W)
  let current = (activePowerKw * 1000) / voltage;
  if (jitter) current += randBetween(-0.4, 0.4);
  current = round(Math.max(0.1, current), 2);

  return {
    voltage,
    current,
    activePower: activePowerKw,
    energy: energyKwh,
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
 * Build webhook payload exactly as a physical energy meter sends:
 * { "Energy Meter_1": "DD/MM/YYYY HH:mm:ss,[n1,n2,n3,n4]" }
 * Raw array order follows DEFAULT_PARAMETERS (voltage, current, activePower, energy).
 */
function buildEnergyMeterPayload(device, options = {}) {
  const { advanceReading = true } = options;
  const profile = getProfileConfig(device.machineProfile || 'warehouse');

  const readings = generateElectricalReadings(device, profile, {
    advanceEnergy: advanceReading,
  });

  const rawValues = readingsToRawValues(readings);
  const dateStr = formatEnergyMeterDate();
  const meterKey = device.deviceId;

  return {
    payload: {
      [meterKey]: `${dateStr},[${rawValues.join(',')}]`,
    },
    readings,
    rawValues,
    energyKwh: readings.energy,
    dateStr,
    profile,
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

module.exports = {
  ENERGY_MACHINE_PROFILES,
  VALID_INTERVALS_SECONDS,
  DEFAULT_PARAMETERS,
  formatEnergyMeterDate,
  getProfileConfig,
  generateElectricalReadings,
  readingsToRawValues,
  buildEnergyMeterPayload,
  buildUidFromCompany,
};
