import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import styles from './EnergyDailyBarChart.module.css';

const DEFAULT_BAR_COLOR = '#6f42c1';
const PEAK_BAR_COLOR = '#d63384';

function formatHourTick(label) {
  if (!label) return '';
  const hour = Number(String(label).slice(0, 2));
  if (!Number.isFinite(hour)) return label;
  if (hour === 0) return '12a';
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return '12p';
  return `${hour - 12}p`;
}

export default function EnergyHourlyBarChart({
  data = [],
  peakHourStart = null,
  height = 180,
}) {
  const hasUsage = data.some((bucket) => Number(bucket.kwh) > 0);

  const chartData = useMemo(
    () =>
      data.map((bucket) => ({
        ...bucket,
        isPeak: peakHourStart != null && bucket.label === peakHourStart,
      })),
    [data, peakHourStart]
  );

  if (!hasUsage) {
    return (
      <div className={styles.wrap}>
        <div className={styles.chartTitle}>Today&apos;s Hourly Consumption</div>
        <div className={styles.chartSubtitle}>Each bar = kWh used in that hour (IST)</div>
        <div className={styles.empty}>No hourly usage recorded for today yet.</div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.chartTitle}>Today&apos;s Hourly Consumption</div>
      <div className={styles.chartSubtitle}>Each bar = kWh used in that hour (IST)</div>
      <div className={styles.chartBody}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9 }}
              interval={2}
              tickFormatter={formatHourTick}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              width={48}
              tickFormatter={(v) => (Number(v) >= 100 ? Number(v).toFixed(0) : Number(v).toFixed(1))}
              label={{
                value: 'kWh',
                angle: -90,
                position: 'insideLeft',
                offset: 0,
                fontSize: 10,
                fill: '#6c757d',
              }}
            />
            <Tooltip
              formatter={(v) => [`${Number(v).toFixed(2)} kWh`, 'Used this hour']}
              labelFormatter={(_, payload) => {
                const bucket = payload?.[0]?.payload;
                if (!bucket?.label) return '';
                const endHour = String((bucket.hour + 1) % 24).padStart(2, '0');
                return `${bucket.label} – ${endHour}:00 IST`;
              }}
            />
            <Bar dataKey="kwh" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {chartData.map((bucket) => (
                <Cell
                  key={bucket.hour}
                  fill={bucket.isPeak ? PEAK_BAR_COLOR : DEFAULT_BAR_COLOR}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
