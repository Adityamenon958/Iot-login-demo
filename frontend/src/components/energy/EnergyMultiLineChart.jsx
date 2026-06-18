import React, { useMemo } from 'react';
import { Spinner } from 'react-bootstrap';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { CHART_COLORS, formatAxisLabel } from './energyChartShared';
import styles from './EnergyMultiLineChart.module.css';

export default function EnergyMultiLineChart({
  chartSeries = [],
  visibleMeters,
  range = '24h',
  unit = '',
  height = 320,
  referenceLines = [],
  loading = false,
}) {
  const visibleSet = visibleMeters || new Set(chartSeries.map((s) => s.meterId));

  const { chartData, meterIds } = useMemo(() => {
    const map = new Map();
    const ids = [];

    chartSeries.forEach((series) => {
      if (!visibleSet.has(series.meterId)) return;
      ids.push(series.meterId);
      (series.points || []).forEach((pt) => {
        const key = pt.timestamp;
        if (!map.has(key)) {
          map.set(key, {
            timestamp: pt.timestamp,
            label: formatAxisLabel(pt.timestamp, range),
          });
        }
        map.get(key)[series.meterId] = pt.value;
      });
    });

    const data = Array.from(map.values()).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    return { chartData: data, meterIds: ids };
  }, [chartSeries, visibleSet, range]);

  if (loading) {
    return (
      <div className={styles.loading} style={{ height }}>
        <Spinner animation="border" size="sm" variant="primary" />
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className={styles.empty} style={{ height }}>
        No data in this range
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} unit={unit ? ` ${unit}` : ''} width={48} />
        <Tooltip
          formatter={(val) => (val != null ? `${Number(val).toFixed(2)}${unit ? ` ${unit}` : ''}` : '—')}
          labelStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {referenceLines.map((ref) => (
          <ReferenceLine
            key={ref.value}
            y={ref.value}
            stroke={ref.stroke}
            strokeDasharray="4 4"
            label={{ value: ref.label, position: 'insideTopRight', fontSize: 10 }}
          />
        ))}
        {meterIds.map((meterId, idx) => (
          <Line
            key={meterId}
            type="monotone"
            dataKey={meterId}
            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
            dot={false}
            strokeWidth={2}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
