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

export function formatMeterDisplayLabel(meterId, machineName) {
  const id = String(meterId || '').trim();
  const name = String(machineName || '').trim();
  if (!id) return name || '—';
  if (!name) return id;
  return `${id} (${name})`;
}

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

/** Align per-meter points by exact timestamp so dips and spikes are not averaged away. */
export function buildMultiSeriesChartData(chartSeries, visibleSet) {
  const map = new Map();
  const meterIds = [];

  chartSeries.forEach((series) => {
    if (!visibleSet.has(series.meterId)) return;
    if (!meterIds.includes(series.meterId)) meterIds.push(series.meterId);

    (series.points || []).forEach((pt) => {
      const t = new Date(pt.timestamp).getTime();
      if (!Number.isFinite(t)) return;
      if (!map.has(t)) {
        map.set(t, {
          bucketTs: t,
          timestamp: new Date(t).toISOString(),
        });
      }
      map.get(t)[series.meterId] = pt.value;
    });
  });

  const chartData = Array.from(map.values()).sort((a, b) => a.bucketTs - b.bucketTs);
  return { chartData, meterIds };
}

/** Y-axis padding so normal operating range fills the chart instead of 0..max. */
export function computeChartYDomain(chartData, meterIds, referenceLines = []) {
  const values = [];
  chartData.forEach((row) => {
    meterIds.forEach((id) => {
      const v = row[id];
      if (v != null && Number.isFinite(Number(v))) values.push(Number(v));
    });
  });
  (referenceLines || []).forEach((ref) => {
    if (ref?.value != null && Number.isFinite(Number(ref.value))) {
      values.push(Number(ref.value));
    }
  });
  if (!values.length) return ['auto', 'auto'];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const pad = Math.max(span * 0.1, 1);
  return [min - pad, max + pad];
}
