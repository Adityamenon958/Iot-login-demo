import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import styles from './EnergyDailyBarChart.module.css';

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function EnergyDailyBarChart({ data = [], height = 200 }) {
  if (!data.length) {
    return <div className={styles.empty}>No daily data for this period.</div>;
  }

  const chartData = data.map((d) => ({
    ...d,
    label: formatDateLabel(d.date),
  }));

  return (
    <div className={styles.wrap}>
      <div className={styles.chartTitle}>Daily Consumption</div>
      <div className={styles.chartBody}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
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
              formatter={(v) => [`${Number(v).toFixed(2)} kWh`, 'Consumption']}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''}
            />
            <Bar dataKey="kwh" fill="#6f42c1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
