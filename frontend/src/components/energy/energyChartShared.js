export const CHART_RANGES = [
  { key: '15m', label: '15m' },
  { key: '1h', label: '1h' },
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
];

export const CHART_COLORS = [
  '#0d6efd',
  '#198754',
  '#fd7e14',
  '#6f42c1',
  '#dc3545',
  '#20c997',
  '#0dcaf0',
  '#6610f2',
];

export const METER_SEARCH_THRESHOLD = 10;
export const MINI_CHART_METER_LIMIT = 5;

export function formatAxisLabel(timestamp, range) {
  const d = new Date(timestamp);
  if (range === '15m' || range === '1h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '24h') {
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatSubtitleDate(value) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildChartSubtitle(chartMeta) {
  if (!chartMeta) return null;
  const { dataStart, dataEnd } = chartMeta;
  if (dataStart && dataEnd) {
    return `Showing data from ${formatSubtitleDate(dataStart)} to ${formatSubtitleDate(dataEnd)}`;
  }
  if (chartMeta.requestedSince && chartMeta.requestedUntil) {
    return `No data in this range (${formatSubtitleDate(chartMeta.requestedSince)} to ${formatSubtitleDate(chartMeta.requestedUntil)})`;
  }
  return null;
}

export function formatStatValue(value, unit, decimals = 2, isLoadFactor = false) {
  if (value == null) return '—';
  if (isLoadFactor) return `${Math.round(Number(value) * 100)}%`;
  const formatted = Number(value).toFixed(decimals);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatRangeValue(latestRange, unit, decimals) {
  if (!latestRange) return 'No data yet';
  if (latestRange.single || latestRange.min === latestRange.max) {
    return `${Number(latestRange.min).toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
  }
  return `${Number(latestRange.min).toFixed(decimals)}–${Number(latestRange.max).toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
}
