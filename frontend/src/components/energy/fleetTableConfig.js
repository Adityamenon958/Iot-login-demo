export const STALE_COMMUNICATION_MS = 30 * 60 * 1000;

export const FLEET_TABLE_RANGES = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
];

export const TABLE_DENSITY_MODES = {
  comfortable: 'densityComfortable',
  compact: 'densityCompact',
};

export const DEFAULT_DENSITY = 'comfortable';

export const DEFAULT_SORT_KEY = 'healthPriority';

export const HEALTH_SORT_RANK = {
  critical: 0,
  warning: 1,
  healthy: 2,
  unknown: 3,
};

export const STATUS_FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
];

export const STATUS_LABEL_BY_STATE = {
  live: 'Online',
  silent: 'Offline (Silent)',
  stale: 'Offline (Stale)',
  never_reported: 'Never Reported',
};

export const STATUS_BADGE_VARIANT = {
  live: 'success',
  silent: 'secondary',
  stale: 'warning',
  never_reported: 'secondary',
};

export const SORTABLE_COLUMNS = [
  { key: 'meterId', label: 'Meter' },
  { key: 'statusLabel', label: 'Status' },
  { key: 'activePowerKw', label: 'Current Power' },
  { key: 'peakPowerKw', label: 'Peak Power' },
  { key: 'energyKwh', label: 'Energy' },
  { key: 'voltage', label: 'Voltage' },
  { key: 'current', label: 'Current' },
  { key: 'powerFactor', label: 'Power Factor' },
  { key: 'frequency', label: 'Frequency' },
  { key: 'healthStatus', label: 'Health' },
  { key: 'lastTimestamp', label: 'Last Communication' },
];

export function getStatusLabel(row) {
  return row.statusLabel || STATUS_LABEL_BY_STATE[row.communicationState] || '—';
}

export function matchesSearch(row, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [row.meterId, row.machineName, row.siteName, row.plantName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function matchesStatusFilter(row, filterKey) {
  if (filterKey === 'online') return row.communicationState === 'live';
  if (filterKey === 'offline') return row.communicationState !== 'live';
  return true;
}

export function defaultSortRows(rows) {
  return [...rows].sort((a, b) => {
    const ha = HEALTH_SORT_RANK[a.healthStatus] ?? 3;
    const hb = HEALTH_SORT_RANK[b.healthStatus] ?? 3;
    if (ha !== hb) return ha - hb;
    const ta = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
    const tb = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
    return tb - ta;
  });
}

function getSortValue(row, sortKey) {
  if (sortKey === 'meterId') return (row.meterId || '').toLowerCase();
  if (sortKey === 'statusLabel') return getStatusLabel(row).toLowerCase();
  if (sortKey === 'healthStatus') return HEALTH_SORT_RANK[row.healthStatus] ?? 3;
  if (sortKey === 'lastTimestamp') {
    return row.lastTimestamp ? new Date(row.lastTimestamp).getTime() : 0;
  }
  if (sortKey === 'activePowerKw') return row.readings?.activePowerKw;
  if (sortKey === 'peakPowerKw') return row.readings?.peakPowerKw;
  if (sortKey === 'energyKwh') return row.readings?.energyKwh;
  if (sortKey === 'voltage') return row.readings?.voltage;
  if (sortKey === 'current') return row.readings?.current;
  if (sortKey === 'powerFactor') return row.readings?.powerFactor;
  if (sortKey === 'frequency') return row.readings?.frequency;
  return null;
}

export function sortRowsByColumn(rows, sortKey, direction = 'asc') {
  const dir = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = getSortValue(a, sortKey);
    const bv = getSortValue(b, sortKey);

    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;

    if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv) * dir;
    }

    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

export function filterAndSortRows(rows, { searchQuery, statusFilter, sortKey, sortDirection }) {
  const filtered = rows.filter(
    (row) => matchesSearch(row, searchQuery) && matchesStatusFilter(row, statusFilter)
  );

  if (!sortKey || sortKey === DEFAULT_SORT_KEY) {
    return defaultSortRows(filtered);
  }

  return sortRowsByColumn(filtered, sortKey, sortDirection);
}

export function computeFooterStats(rows, rangeKey) {
  const totalMeters = rows.length;
  const onlineMeters = rows.filter((r) => r.communicationState === 'live').length;
  const offlineMeters = totalMeters - onlineMeters;

  let totalCurrentPower = 0;
  let totalEnergy = 0;
  let hasPower = false;
  let hasEnergy = false;

  rows.forEach((row) => {
    const p = row.readings?.activePowerKw;
    const e = row.readings?.energyKwh;
    if (p != null && Number.isFinite(Number(p))) {
      totalCurrentPower += Number(p);
      hasPower = true;
    }
    if (e != null && Number.isFinite(Number(e))) {
      totalEnergy += Number(e);
      hasEnergy = true;
    }
  });

  const rangeLabel = FLEET_TABLE_RANGES.find((r) => r.key === rangeKey)?.label || rangeKey;

  return {
    totalMeters,
    onlineMeters,
    offlineMeters,
    totalCurrentPower: hasPower ? totalCurrentPower : null,
    totalEnergy: hasEnergy ? totalEnergy : null,
    rangeLabel,
  };
}

function escapeCsv(value) {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildFleetTableCsv(rows, rangeLabel) {
  const headers = [
    'Meter ID',
    'Machine Name',
    'Site',
    'Status',
    'Current Power (kW)',
    'Peak Power (kW)',
    'Energy (kWh)',
    'Voltage (V)',
    'Current (A)',
    'Power Factor',
    'Frequency (Hz)',
    'Health',
    'Last Communication',
    `Period (${rangeLabel})`,
  ];

  const lines = rows.map((row) => {
    const r = row.readings || {};
    return [
      row.meterId,
      row.machineName,
      row.siteName,
      getStatusLabel(row),
      r.activePowerKw,
      r.peakPowerKw,
      r.energyKwh,
      r.voltage,
      r.current,
      r.powerFactor,
      r.frequency,
      row.healthStatus,
      row.lastCommunication,
      rangeLabel,
    ]
      .map(escapeCsv)
      .join(',');
  });

  return [headers.join(','), ...lines].join('\n');
}

export const ENABLE_FLEET_CSV_EXPORT = false;
