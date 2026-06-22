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
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10 }} width={36} unit=" kWh" />
          <Tooltip
            formatter={(v) => [`${Number(v).toFixed(2)} kWh`, 'Consumption']}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ''}
          />
          <Bar dataKey="kwh" fill="#6f42c1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
