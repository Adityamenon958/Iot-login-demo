import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatSubtitleDate } from './energyChartShared';
import styles from './EnergyDailyBarChart.module.css';

export default function EnergyConsumptionTrendChart({ data = [], height = 180 }) {
  if (!data.length) {
    return <div className={styles.empty}>No trend data for this period.</div>;
  }

  const chartData = data.map((pt) => ({
    ...pt,
    timeMs: new Date(pt.timestamp).getTime(),
  }));

  return (
    <div className={styles.wrap}>
      <div className={styles.chartTitle}>Consumption Trend (period)</div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis
            dataKey="timeMs"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 10 }}
            tickFormatter={(ms) =>
              new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            }
          />
          <YAxis tick={{ fontSize: 10 }} width={40} unit=" kWh" />
          <Tooltip
            labelFormatter={(_, payload) => {
              const ts = payload?.[0]?.payload?.timestamp;
              return ts ? formatSubtitleDate(ts) : '';
            }}
            formatter={(v) => [`${Number(v).toFixed(2)} kWh`, 'Used']}
          />
          <Line
            type="monotone"
            dataKey="consumptionKwh"
            stroke="#6f42c1"
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
