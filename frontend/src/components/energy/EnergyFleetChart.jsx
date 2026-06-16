import React, { useMemo, useState } from 'react';
import { Card } from 'react-bootstrap';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import styles from './EnergyFleetChart.module.css';

const RANGES = [
  { key: '15m', ms: 15 * 60 * 1000 },
  { key: '1h', ms: 60 * 60 * 1000 },
  { key: '24h', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
];

const COLORS = ['#0d6efd', '#198754', '#fd7e14', '#6f42c1', '#dc3545', '#20c997'];

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function EnergyFleetChart({ chartSeries = [] }) {
  const [range, setRange] = useState('24h');

  const chartData = useMemo(() => {
    const rangeMs = RANGES.find((r) => r.key === range)?.ms || RANGES[2].ms;
    const since = Date.now() - rangeMs;
    const map = new Map();

    chartSeries.forEach((series) => {
      series.points.forEach((pt) => {
        const t = new Date(pt.timestamp).getTime();
        if (t < since) return;
        const key = pt.timestamp;
        if (!map.has(key)) {
          map.set(key, { timestamp: pt.timestamp, label: formatTime(pt.timestamp) });
        }
        map.get(key)[series.meterId] = pt.value;
      });
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
  }, [chartSeries, range]);

  const meterIds = chartSeries.map((s) => s.meterId);

  return (
    <Card className={styles.chartCard}>
      <Card.Body>
        <div className={styles.chartHeader}>
          <h6 className={styles.chartTitle}>Fleet Energy (kWh)</h6>
          <div className={styles.rangePills}>
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`${styles.pill} ${range === r.key ? styles.pillActive : ''}`}
                onClick={() => setRange(r.key)}
              >
                {r.key}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.chartWrap}>
          {chartData.length === 0 ? (
            <div className={styles.empty}>No chart data yet. Run the seed script or connect a meter.</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {meterIds.map((id, i) => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    stroke={COLORS[i % COLORS.length]}
                    dot={false}
                    strokeWidth={2}
                    name={id}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
