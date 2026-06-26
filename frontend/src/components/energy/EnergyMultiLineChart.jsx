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
import {
  CHART_COLORS,
  formatAxisLabel,
  buildMultiSeriesChartData,
  computeChartYDomain,
} from './energyChartShared';
import ChartMultiSeriesTooltip from './ChartMultiSeriesTooltip';
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
  const visibleSet = useMemo(
    () => visibleMeters || new Set(chartSeries.map((s) => s.meterId)),
    [visibleMeters, chartSeries]
  );

  const { chartData, meterIds } = useMemo(
    () => buildMultiSeriesChartData(chartSeries, visibleSet),
    [chartSeries, visibleSet]
  );

  const yDomain = useMemo(
    () => computeChartYDomain(chartData, meterIds, referenceLines),
    [chartData, meterIds, referenceLines]
  );

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
        <XAxis
          dataKey="bucketTs"
          tick={{ fontSize: 11 }}
          tickFormatter={(ts) => formatAxisLabel(new Date(Number(ts)), range)}
          minTickGap={range === '7d' ? 48 : 24}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          unit={unit ? ` ${unit}` : ''}
          width={48}
          domain={yDomain}
        />
        <Tooltip
          shared
          content={(props) => (
            <ChartMultiSeriesTooltip {...props} meterIds={meterIds} unit={unit} />
          )}
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
            type="linear"
            dataKey={meterId}
            name={meterId}
            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
            dot={chartData.length <= 400}
            activeDot={{ r: 4 }}
            strokeWidth={2}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
