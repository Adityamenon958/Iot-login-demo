const Device = require('../models/Device');
const EnergyMeterParameterMap = require('../models/EnergyMeterParameterMap');
const CompanyDashboardAccess = require('../models/CompanyDashboardAccess');
const SimulatorDevice = require('../models/SimulatorDevice');

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

const ENERGY_VIEW_MODES = ['all', 'real_only', 'simulator_only'];
const ENERGY_DATA_SOURCES = ['simulator', 'device'];

const CHART_RANGE_MS = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

function parseChartRange(rangeKey) {
  const key = Object.prototype.hasOwnProperty.call(CHART_RANGE_MS, rangeKey) ? rangeKey : '24h';
  return { key, ms: CHART_RANGE_MS[key] };
}

const DEFAULT_PARAMETERS = [
  { index: 0, key: 'voltage', label: 'Voltage', unit: 'V', scale: 0.1 },
  { index: 1, key: 'current', label: 'Current', unit: 'A', scale: 0.01 },
  { index: 2, key: 'activePower', label: 'Active Power', unit: 'kW', scale: 0.01 },
  { index: 3, key: 'energy', label: 'Energy', unit: 'kWh', scale: 0.1 },
];

function parseDeviceDateString(d) {
  if (typeof d !== 'string' || !d.includes('/')) return null;
  const [date, time = '00:00:00'] = d.split(' ');
  const [dd, mm, yyyy] = date.split('/').map(Number);
  const [h, m, s] = time.split(':').map(Number);
  if (!yyyy || !mm || !dd) return null;
  return new Date(Date.UTC(yyyy, mm - 1, dd, h || 0, m || 0, s || 0));
}

function parseBracketArray(str) {
  if (typeof str !== 'string') return null;
  const match = str.match(/\[([^\]]+)\]/);
  if (!match) return null;
  const values = match[1]
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n));
  return values.length ? values : null;
}

/**
 * Best-effort parse for known sample format:
 * "10/06/2026 13:52:33,[6533,6533,6533,6533]"
 */
function parseSampleValueString(value) {
  if (typeof value !== 'string') {
    return { D: null, rawValues: null, parseStatus: 'partial' };
  }

  const commaIdx = value.indexOf(',');
  if (commaIdx === -1) {
    const maybeDate = parseDeviceDateString(value.trim());
    if (maybeDate) {
      return {
        D: value.trim(),
        rawValues: null,
        timestamp: maybeDate,
        parseStatus: 'partial',
      };
    }
    return { D: null, rawValues: null, parseStatus: 'partial' };
  }

  const datePart = value.slice(0, commaIdx).trim();
  const arrayPart = value.slice(commaIdx + 1).trim();
  const rawValues = parseBracketArray(arrayPart);
  const timestamp = parseDeviceDateString(datePart);

  if (rawValues && timestamp) {
    return { D: datePart, rawValues, timestamp, parseStatus: 'parsed' };
  }
  if (rawValues || timestamp) {
    return {
      D: datePart || null,
      rawValues: rawValues || null,
      timestamp: timestamp || null,
      parseStatus: 'partial',
    };
  }

  return { D: datePart || null, rawValues: null, parseStatus: 'partial' };
}

function extractMeterEntries(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return [];
  }

  return Object.entries(body).map(([meterId, value]) => ({
    meterId: String(meterId),
    value,
  }));
}

function normalizeMeterId(id) {
  return String(id || '').trim().toLowerCase();
}

async function resolveDeviceForMeter(meterId) {
  const trimmed = String(meterId || '').trim();
  if (!trimmed) return null;

  let device = await Device.findOne({ deviceId: trimmed, deviceType: 'energyMeter' }).lean();
  if (device) return device;

  device = await Device.findOne({ uid: trimmed, deviceType: 'energyMeter' }).lean();
  if (device) return device;

  const normalized = normalizeMeterId(trimmed);
  const candidates = await Device.find({ deviceType: 'energyMeter' }).lean();
  return (
    candidates.find((d) => normalizeMeterId(d.deviceId) === normalized) ||
    candidates.find((d) => normalizeMeterId(d.uid) === normalized) ||
    null
  );
}

async function getParameterMap(meterId) {
  const deviceMap = meterId
    ? await EnergyMeterParameterMap.findOne({ scope: 'device', meterId }).lean()
    : null;
  if (deviceMap?.parameters?.length) return deviceMap.parameters;

  const defaultMap = await EnergyMeterParameterMap.findOne({ scope: 'default', meterId: null }).lean();
  if (defaultMap?.parameters?.length) return defaultMap.parameters;

  return DEFAULT_PARAMETERS;
}

function buildReadings(rawValues, parameters) {
  const readings = {};
  if (!Array.isArray(rawValues) || !rawValues.length) return readings;

  rawValues.forEach((raw, idx) => {
    const param = parameters.find((p) => p.index === idx) || {
      index: idx,
      key: `channel_${idx}`,
      label: `Channel ${idx + 1}`,
      unit: '',
      scale: 1,
    };
    readings[param.key] = Number(raw) * (param.scale ?? 1);
  });

  return readings;
}

function isMeterOnline(lastTimestamp) {
  if (!lastTimestamp) return false;
  const ts = new Date(lastTimestamp).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= ONLINE_WINDOW_MS;
}

function formatRelativeTime(date) {
  if (!date) return 'No data yet';
  const ts = new Date(date).getTime();
  if (!Number.isFinite(ts)) return 'No data yet';
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return 'Just now';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec} sec ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

async function ensureDefaultParameterMap() {
  const existing = await EnergyMeterParameterMap.findOne({ scope: 'default', meterId: null });
  if (!existing) {
    return EnergyMeterParameterMap.create({
      scope: 'default',
      meterId: null,
      parameters: DEFAULT_PARAMETERS,
    });
  }

  const isLegacy = (existing.parameters || []).some((p) => String(p.key || '').startsWith('channel_'));
  if (isLegacy) {
    existing.parameters = DEFAULT_PARAMETERS;
    await existing.save();
  }
  return existing;
}

/** Prefer energy or active power for charts and meter cards */
function pickChartMetric(row) {
  if (row?.readings?.energy != null) return Number(row.readings.energy);
  if (row?.readings?.activePower != null) return Number(row.readings.activePower);
  if (Array.isArray(row?.rawValues) && row.rawValues.length >= 4) {
    return row.rawValues[3] * 0.1;
  }
  return 0;
}

function pickDisplayReading(readings) {
  if (!readings || typeof readings !== 'object') return null;
  const prefer = ['activePower', 'energy', 'voltage', 'current'];
  for (const key of prefer) {
    if (readings[key] != null) {
      const meta = DEFAULT_PARAMETERS.find((p) => p.key === key);
      return {
        key,
        value: readings[key],
        label: meta?.label || key,
        unit: meta?.unit || '',
      };
    }
  }
  const [key, value] = Object.entries(readings)[0] || [];
  const meta = DEFAULT_PARAMETERS.find((p) => p.key === key);
  return key ? { key, value, label: meta?.label || key, unit: meta?.unit || '' } : null;
}

function assertValidDataSource(dataSource) {
  if (!dataSource || !ENERGY_DATA_SOURCES.includes(dataSource)) {
    throw new Error(`dataSource must be one of: ${ENERGY_DATA_SOURCES.join(', ')}`);
  }
}

function mergeMongoFilters(base = {}, extra = {}) {
  const hasBase = base && Object.keys(base).length > 0;
  const hasExtra = extra && Object.keys(extra).length > 0;
  if (!hasBase) return { ...extra };
  if (!hasExtra) return { ...base };
  return { $and: [base, extra] };
}

async function getCompanyEnergyViewMode(companyName) {
  if (!companyName) return 'all';
  const access = await CompanyDashboardAccess.findOne({ companyName }).lean();
  const mode = access?.energySettings?.viewMode;
  return ENERGY_VIEW_MODES.includes(mode) ? mode : 'all';
}

async function getSimulatorMeterIdsForCompany(companyName) {
  const sims = await SimulatorDevice.find({ deviceType: 'energyMeter' }).select('deviceId').lean();
  const simIds = sims.map((s) => s.deviceId).filter(Boolean);
  if (!simIds.length) return [];

  const deviceFilter = { deviceType: 'energyMeter', deviceId: { $in: simIds } };
  if (companyName) deviceFilter.companyName = companyName;

  const devices = await Device.find(deviceFilter).select('deviceId').lean();
  return devices.map((d) => d.deviceId);
}

function buildLogVisibilityQuery(viewMode, simulatorMeterIds = []) {
  if (!viewMode || viewMode === 'all') return {};

  const ids = simulatorMeterIds || [];

  if (viewMode === 'real_only') {
    return {
      $or: [
        { dataSource: 'device' },
        { dataSource: { $exists: false }, meterId: { $nin: ids } },
      ],
    };
  }

  if (viewMode === 'simulator_only') {
    return {
      $or: [
        { dataSource: 'simulator' },
        { dataSource: { $exists: false }, meterId: { $in: ids } },
      ],
    };
  }

  return {};
}

function buildMeterVisibilityFilter(viewMode, simulatorMeterIds = []) {
  if (!viewMode || viewMode === 'all') return {};

  const ids = simulatorMeterIds || [];

  if (viewMode === 'real_only') {
    return ids.length ? { deviceId: { $nin: ids } } : {};
  }

  if (viewMode === 'simulator_only') {
    return ids.length ? { deviceId: { $in: ids } } : { deviceId: { $in: [] } };
  }

  return {};
}

async function buildLogFilterForCompany(companyName, baseFilter = {}) {
  const viewMode = await getCompanyEnergyViewMode(companyName);
  const simIds = await getSimulatorMeterIdsForCompany(companyName);
  return mergeMongoFilters(baseFilter, buildLogVisibilityQuery(viewMode, simIds));
}

async function buildLogFilterForMeters(meters, baseFilter = {}) {
  if (!meters?.length) {
    return mergeMongoFilters(baseFilter, { _id: { $exists: false } });
  }

  const byCompany = {};
  meters.forEach((m) => {
    const cn = m.companyName || '';
    if (!byCompany[cn]) byCompany[cn] = [];
    byCompany[cn].push(m.deviceId);
  });

  const orClauses = [];
  for (const [companyName, meterIds] of Object.entries(byCompany)) {
    const viewMode = await getCompanyEnergyViewMode(companyName);
    const simIds = await getSimulatorMeterIdsForCompany(companyName);
    const visibility = buildLogVisibilityQuery(viewMode, simIds);
    orClauses.push(mergeMongoFilters({ meterId: { $in: meterIds } }, visibility));
  }

  if (orClauses.length === 1) {
    return mergeMongoFilters(baseFilter, orClauses[0]);
  }

  return mergeMongoFilters(baseFilter, { $or: orClauses });
}

function viewModeToShowSimulator(viewMode) {
  return viewMode !== 'real_only';
}

function showSimulatorToViewMode(showSimulatorData) {
  return showSimulatorData ? 'all' : 'real_only';
}

module.exports = {
  ONLINE_WINDOW_MS,
  CHART_RANGE_MS,
  ENERGY_VIEW_MODES,
  ENERGY_DATA_SOURCES,
  parseChartRange,
  DEFAULT_PARAMETERS,
  parseDeviceDateString,
  parseSampleValueString,
  extractMeterEntries,
  resolveDeviceForMeter,
  getParameterMap,
  buildReadings,
  isMeterOnline,
  formatRelativeTime,
  ensureDefaultParameterMap,
  pickChartMetric,
  pickDisplayReading,
  assertValidDataSource,
  mergeMongoFilters,
  getCompanyEnergyViewMode,
  getSimulatorMeterIdsForCompany,
  buildLogVisibilityQuery,
  buildMeterVisibilityFilter,
  buildLogFilterForCompany,
  buildLogFilterForMeters,
  viewModeToShowSimulator,
  showSimulatorToViewMode,
};
