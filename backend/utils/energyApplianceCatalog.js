/**
 * Appliance catalog, room presets, IST schedules, and load computation for energy meter simulator.
 */

const ROOM_TYPES = ['office', 'warehouse', 'manufacturing', 'retail'];
const INDUSTRIAL_STATES = ['running', 'idle', 'stopped', 'maintenance'];

const DEFAULT_STATE_DISTRIBUTION = {
  running: 80,
  idle: 15,
  stopped: 5,
  maintenance: 0,
};

const STATE_POWER_MULTIPLIERS = {
  running: [0.85, 1.0],
  idle: [0.1, 0.2],
  stopped: [0, 0.02],
  maintenance: [0.05, 0.15],
};

const APPLIANCE_CATALOG = {
  ac_split: {
    label: 'AC (Split)',
    defaultRatedKw: 1.5,
    powerKwRange: [1.2, 2.2],
    pfRange: [0.75, 0.95],
    pattern: 'thermostat',
    scheduleGroup: 'climate',
    isIndustrial: false,
  },
  lights_led: {
    label: 'LED Lights',
    defaultRatedKw: 0.04,
    powerKwRange: [0.03, 0.06],
    pfRange: [0.9, 0.98],
    pattern: 'constant',
    scheduleGroup: 'lighting',
    isIndustrial: false,
  },
  lights_tube: {
    label: 'Tube Lights',
    defaultRatedKw: 0.05,
    powerKwRange: [0.04, 0.07],
    pfRange: [0.85, 0.95],
    pattern: 'constant',
    scheduleGroup: 'lighting',
    isIndustrial: false,
  },
  pc_workstation: {
    label: 'PC Workstation',
    defaultRatedKw: 0.15,
    powerKwRange: [0.1, 0.25],
    pfRange: [0.9, 0.98],
    pattern: 'constant',
    scheduleGroup: 'office_equipment',
    isIndustrial: false,
  },
  oven: {
    label: 'Oven',
    defaultRatedKw: 2.5,
    powerKwRange: [1.5, 3.5],
    pfRange: [0.95, 1.0],
    pattern: 'intermittent',
    scheduleGroup: 'kitchen',
    isIndustrial: false,
  },
  conveyor: {
    label: 'Conveyor',
    defaultRatedKw: 1.8,
    powerKwRange: [1.1, 2.3],
    pfRange: [0.75, 0.9],
    pattern: 'industrial',
    scheduleGroup: 'production',
    isIndustrial: true,
  },
  cnc: {
    label: 'CNC Machine',
    defaultRatedKw: 7.0,
    powerKwRange: [4.5, 11.5],
    pfRange: [0.8, 0.95],
    pattern: 'industrial',
    scheduleGroup: 'production',
    isIndustrial: true,
  },
  compressor: {
    label: 'Compressor',
    defaultRatedKw: 5.5,
    powerKwRange: [2.8, 8.2],
    pfRange: [0.7, 0.9],
    pattern: 'industrial',
    scheduleGroup: 'production',
    isIndustrial: true,
  },
  packaging_machine: {
    label: 'Packaging Machine',
    defaultRatedKw: 3.2,
    powerKwRange: [2.0, 4.5],
    pfRange: [0.78, 0.92],
    pattern: 'industrial',
    scheduleGroup: 'production',
    isIndustrial: true,
  },
  exhaust_fan: {
    label: 'Exhaust Fan',
    defaultRatedKw: 0.8,
    powerKwRange: [0.5, 1.2],
    pfRange: [0.8, 0.9],
    pattern: 'constant',
    scheduleGroup: 'ventilation',
    isIndustrial: false,
  },
  ceiling_fan: {
    label: 'Ceiling Fan',
    defaultRatedKw: 0.075,
    powerKwRange: [0.05, 0.12],
    pfRange: [0.75, 0.9],
    pattern: 'constant',
    scheduleGroup: 'ventilation',
    isIndustrial: false,
  },
};

const ROOM_PRESETS = {
  office: [
    { type: 'lights_led', count: 12 },
    { type: 'ac_split', count: 2 },
    { type: 'pc_workstation', count: 8 },
  ],
  warehouse: [
    { type: 'lights_tube', count: 20 },
    { type: 'exhaust_fan', count: 4 },
    { type: 'conveyor', count: 1 },
  ],
  manufacturing: [
    { type: 'lights_led', count: 16 },
    { type: 'cnc', count: 2 },
    { type: 'compressor', count: 1 },
    { type: 'conveyor', count: 2 },
    { type: 'packaging_machine', count: 1 },
  ],
  retail: [
    { type: 'lights_led', count: 24 },
    { type: 'ac_split', count: 4 },
    { type: 'exhaust_fan', count: 2 },
  ],
};

const MACHINE_PROFILE_TO_APPLIANCE = {
  warehouse: 'exhaust_fan',
  cnc: 'cnc',
  compressor: 'compressor',
  conveyor: 'conveyor',
};

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

function getCatalog() {
  return {
    appliances: Object.entries(APPLIANCE_CATALOG).map(([id, cfg]) => ({
      id,
      ...cfg,
    })),
    roomTypes: ROOM_TYPES.map((id) => ({
      id,
      label: id.charAt(0).toUpperCase() + id.slice(1),
      preset: ROOM_PRESETS[id] || [],
    })),
    industrialStates: INDUSTRIAL_STATES,
    defaultStateDistribution: { ...DEFAULT_STATE_DISTRIBUTION },
  };
}

function getApplianceConfig(type) {
  return APPLIANCE_CATALOG[type] || null;
}

function getRoomPresets(roomType) {
  return (ROOM_PRESETS[roomType] || []).map((row) => ({ ...row }));
}

function normalizeStateDistribution(dist) {
  const base = { ...DEFAULT_STATE_DISTRIBUTION, ...(dist || {}) };
  const total = INDUSTRIAL_STATES.reduce((s, k) => s + (Number(base[k]) || 0), 0);
  if (total <= 0) return { ...DEFAULT_STATE_DISTRIBUTION };
  const normalized = {};
  INDUSTRIAL_STATES.forEach((k) => {
    normalized[k] = ((Number(base[k]) || 0) / total) * 100;
  });
  return normalized;
}

function sampleIndustrialState(dist) {
  const d = normalizeStateDistribution(dist);
  const roll = Math.random() * 100;
  let acc = 0;
  for (const state of INDUSTRIAL_STATES) {
    acc += d[state];
    if (roll <= acc) return state;
  }
  return 'running';
}

/** IST wall-clock parts from a Date */
function getIstParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  const weekday = weekdayMap[get('weekday')] ?? 0;
  return { hour, minute, minutesOfDay: hour * 60 + minute, weekday, isWeekend: weekday === 0 || weekday === 6 };
}

/**
 * Schedule activity factor 0–1 by room type and IST time.
 */
function getScheduleActivityFactor(roomType, now = new Date()) {
  const { minutesOfDay, isWeekend } = getIstParts(now);

  if (roomType === 'office') {
    if (isWeekend) return minutesOfDay >= 7 * 60 && minutesOfDay < 19 * 60 ? 0.08 : 0.02;
    if (minutesOfDay >= 9 * 60 && minutesOfDay < 18 * 60) return 1.0;
    if (minutesOfDay >= 7 * 60 && minutesOfDay < 9 * 60) return 0.35;
    if (minutesOfDay >= 18 * 60 && minutesOfDay < 21 * 60) return 0.2;
    return 0.03;
  }

  if (roomType === 'warehouse') {
    if (minutesOfDay >= 8 * 60 && minutesOfDay < 20 * 60) return isWeekend ? 0.45 : 0.85;
    return 0.25;
  }

  if (roomType === 'manufacturing') {
    if (isWeekend) return minutesOfDay >= 6 * 60 && minutesOfDay < 14 * 60 ? 0.15 : 0.02;
    const shift1 = minutesOfDay >= 6 * 60 && minutesOfDay < 14 * 60;
    const shift2 = minutesOfDay >= 14 * 60 && minutesOfDay < 22 * 60;
    if (shift1 || shift2) return 1.0;
    return 0.05;
  }

  if (roomType === 'retail') {
    if (minutesOfDay >= 10 * 60 && minutesOfDay < 21 * 60) return isWeekend ? 1.0 : 0.9;
    return 0.1;
  }

  return 0.5;
}

function getGroupActivityFactor(scheduleGroup, roomType, scheduleFactor, occupancyFactor) {
  const occ = occupancyFactor;
  const sf = scheduleFactor;

  if (scheduleGroup === 'lighting') {
    if (sf < 0.05) return 0.05 * occ;
    return sf * occ;
  }
  if (scheduleGroup === 'climate') {
    return sf * (0.7 + 0.3 * occ);
  }
  if (scheduleGroup === 'office_equipment') {
    return sf * occ;
  }
  if (scheduleGroup === 'kitchen') {
    return sf * occ * (0.3 + 0.7 * (Math.random() > 0.6 ? 1 : 0));
  }
  if (scheduleGroup === 'production') {
    return sf * occ;
  }
  if (scheduleGroup === 'ventilation') {
    return (0.3 + 0.7 * sf) * occ;
  }
  return sf * occ;
}

function computeApplianceUnitPower(applianceType, row, roomType, scheduleFactor, occupancyFactor, jitter) {
  const cfg = getApplianceConfig(applianceType);
  if (!cfg) return { kw: 0, pf: 0.9, on: false };

  const ratedKw = row.ratedKwOverride != null && row.ratedKwOverride !== ''
    ? Number(row.ratedKwOverride)
    : cfg.defaultRatedKw;

  const groupFactor = getGroupActivityFactor(cfg.scheduleGroup, roomType, scheduleFactor, occupancyFactor);
  if (groupFactor < 0.02) return { kw: 0, pf: cfg.pfRange[0], on: false };

  let powerMult = 1;
  let on = true;

  if (cfg.isIndustrial || cfg.pattern === 'industrial') {
    const state = sampleIndustrialState(row.stateDistribution);
    const [lo, hi] = STATE_POWER_MULTIPLIERS[state];
    powerMult = randBetween(lo, hi);
    if (state === 'stopped' && Math.random() > 0.3) on = false;
  } else if (cfg.pattern === 'thermostat') {
    const cycle = Math.sin((Date.now() % 600000) / 600000 * Math.PI * 2);
    powerMult = 0.35 + (cycle + 1) * 0.325;
    on = groupFactor > 0.1;
  } else if (cfg.pattern === 'intermittent') {
    on = Math.random() < groupFactor;
    powerMult = on ? randBetween(0.7, 1.0) : 0;
  } else if (cfg.pattern === 'constant') {
    on = Math.random() < Math.min(1, groupFactor + 0.1);
    powerMult = on ? randBetween(0.9, 1.05) : 0;
  }

  if (!on) return { kw: 0, pf: cfg.pfRange[0], on: false };

  let kw = ratedKw * powerMult * clamp(groupFactor, 0, 1);
  if (jitter) kw += randBetween(-ratedKw * 0.05, ratedKw * 0.05);
  kw = round(Math.max(0, kw), 3);

  const pf = round(randBetween(cfg.pfRange[0], cfg.pfRange[1]), 2);
  return { kw, pf, on: kw > 0.001 };
}

function resolveSimApplianceRows(simDevice) {
  const mode = simDevice.energySimMode || 'single';
  if (mode === 'room' && Array.isArray(simDevice.appliances) && simDevice.appliances.length) {
    return simDevice.appliances.filter((r) => r?.type && (r.count || 0) > 0);
  }

  const legacyMap = MACHINE_PROFILE_TO_APPLIANCE[simDevice.machineProfile];
  const singleType = simDevice.singleApplianceType || legacyMap || 'ac_split';
  return [{
    type: singleType,
    count: 1,
    ratedKwOverride: simDevice.singleApplianceRatedKwOverride,
    stateDistribution: simDevice.singleStateDistribution,
  }];
}

/**
 * Compute aggregated load for one simulator tick.
 */
function computeSimulatedLoad(simDevice, now = new Date()) {
  const roomType = simDevice.roomType || 'office';
  const occupancyPercent = clamp(Number(simDevice.occupancyPercent ?? 100), 0, 100);
  const occupancyFactor = occupancyPercent / 100;
  const scheduleFactor = getScheduleActivityFactor(roomType, now);
  const jitter = simDevice.jitter !== false;

  const rows = resolveSimApplianceRows(simDevice);
  const items = [];
  let pTotal = 0;
  let sTotal = 0;

  rows.forEach((row) => {
    const cfg = getApplianceConfig(row.type);
    if (!cfg) return;

    const count = Math.max(1, Number(row.count) || 1);
    const unit = computeApplianceUnitPower(row.type, row, roomType, scheduleFactor, occupancyFactor, jitter);
    const rowKw = round(unit.kw * count, 3);
    const rowPf = unit.pf;

    if (rowKw > 0) {
      pTotal += rowKw;
      sTotal += rowKw / Math.max(rowPf, 0.7);
    }

    items.push({
      type: row.type,
      label: cfg.label,
      count,
      kw: rowKw,
      pf: rowPf,
      on: unit.on && rowKw > 0,
    });
  });

  pTotal = round(pTotal, 3);
  let pfMeter = pTotal > 0 && sTotal > 0 ? round(pTotal / sTotal, 2) : 0.95;
  pfMeter = clamp(pfMeter, 0.7, 1.0);

  return {
    totalKw: pTotal,
    powerFactor: pfMeter,
    items,
    scheduleFactor: round(scheduleFactor, 2),
    occupancyFactor: round(occupancyFactor, 2),
  };
}

function buildConfigSummary(simDevice) {
  const mode = simDevice.energySimMode || 'single';
  if (mode === 'room') {
    const rows = simDevice.appliances || [];
    const parts = rows.slice(0, 3).map((r) => {
      const cfg = getApplianceConfig(r.type);
      return `${cfg?.label || r.type}×${r.count || 1}`;
    });
    return `Room (${simDevice.roomType || 'office'})${parts.length ? `: ${parts.join(', ')}` : ''}`;
  }
  const t = simDevice.singleApplianceType || MACHINE_PROFILE_TO_APPLIANCE[simDevice.machineProfile] || 'ac_split';
  const cfg = getApplianceConfig(t);
  return `Single: ${cfg?.label || t}`;
}

function validateEnergySimBody(body, { isUpdate = false } = {}) {
  const errors = [];
  const mode = body.energySimMode || 'single';
  const roomType = body.roomType || 'office';

  if (mode && !['room', 'single'].includes(mode)) {
    errors.push('energySimMode must be room or single');
  }
  if (body.roomType && !ROOM_TYPES.includes(body.roomType)) {
    errors.push('Invalid roomType');
  }
  if (body.occupancyPercent != null) {
    const occ = Number(body.occupancyPercent);
    if (!Number.isFinite(occ) || occ < 0 || occ > 100) errors.push('occupancyPercent must be 0–100');
  }
  if (body.minVoltage != null && body.maxVoltage != null) {
    if (Number(body.minVoltage) >= Number(body.maxVoltage)) {
      errors.push('minVoltage must be less than maxVoltage');
    }
  }

  if (mode === 'room') {
    const appliances = body.appliances;
    if (!isUpdate && (!Array.isArray(appliances) || !appliances.length)) {
      errors.push('Room mode requires at least one appliance');
    }
    if (Array.isArray(appliances)) {
      appliances.forEach((row, i) => {
        if (!row?.type || !APPLIANCE_CATALOG[row.type]) {
          errors.push(`Invalid appliance type at row ${i + 1}`);
        }
        if (row.count != null && Number(row.count) < 1) {
          errors.push(`Appliance count must be >= 1 at row ${i + 1}`);
        }
      });
    }
  } else if (body.singleApplianceType && !APPLIANCE_CATALOG[body.singleApplianceType]) {
    errors.push('Invalid singleApplianceType');
  }

  return errors;
}

function pickEnergySimFields(body) {
  const fields = {};
  const assign = (key, transform = (v) => v) => {
    if (body[key] !== undefined) fields[key] = transform(body[key]);
  };

  assign('energySimMode');
  assign('roomType');
  assign('scheduleTimezone');
  assign('singleApplianceType');
  assign('occupancyPercent', Number);
  assign('minVoltage', Number);
  assign('maxVoltage', Number);
  assign('energyBaseReading', (v) => (v === '' || v == null ? 0 : Number(v)));
  assign('intervalSeconds', (v) => parseInt(v, 10));
  assign('jitter', (v) => v === true);

  if (body.appliances !== undefined) {
    fields.appliances = body.appliances.map((row) => {
      const entry = {
        type: row.type,
        count: Math.max(1, Number(row.count) || 1),
        ratedKwOverride: row.ratedKwOverride != null && row.ratedKwOverride !== ''
          ? Number(row.ratedKwOverride) : null,
      };
      if (row.stateDistribution) {
        entry.stateDistribution = normalizeStateDistribution(row.stateDistribution);
      }
      return entry;
    });
  }
  if (body.singleApplianceRatedKwOverride !== undefined) {
    fields.singleApplianceRatedKwOverride = body.singleApplianceRatedKwOverride === ''
      ? null : Number(body.singleApplianceRatedKwOverride);
  }
  if (body.singleStateDistribution !== undefined) {
    fields.singleStateDistribution = normalizeStateDistribution(body.singleStateDistribution);
  }

  return fields;
}

module.exports = {
  ROOM_TYPES,
  APPLIANCE_CATALOG,
  ROOM_PRESETS,
  MACHINE_PROFILE_TO_APPLIANCE,
  DEFAULT_STATE_DISTRIBUTION,
  getCatalog,
  getApplianceConfig,
  getRoomPresets,
  normalizeStateDistribution,
  computeSimulatedLoad,
  resolveSimApplianceRows,
  buildConfigSummary,
  validateEnergySimBody,
  pickEnergySimFields,
  getScheduleActivityFactor,
  getIstParts,
};
