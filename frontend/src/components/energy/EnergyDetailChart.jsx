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
import styles from './EnergyDetailChart.module.css';

const RANGES = [
  { key: '15m', ms: 15 * 60 * 1000 },
  { key: '1h', ms: 60 * 60 * 1000 },
  { key: '24h', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
];

const COLORS = ['#0d6efd', '#198754', '#fd7e14', '#6f42c1'];

export default function EnergyDetailChart({ logs = [], parameters = [] }) {
  const [range, setRange] = useState('24h');

  const chartData = useMemo(() => {
    const rangeMs = RANGES.find((r) => r.key === range)?.ms || RANGES[2].ms;
    const since = Date.now() - rangeMs;

    return logs
      .filter((log) => new Date(log.timestamp).getTime() >= since)
      .map((log) => {
        const row = {
          timestamp: log.timestamp,
          label: new Date(log.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };

        if (log.readings && Object.keys(log.readings).length) {
          Object.assign(row, log.readings);
        } else if (Array.isArray(log.rawValues)) {
          log.rawValues.forEach((v, i) => {
            const param = parameters.find((p) => p.index === i);
            const scaled = param?.scale ? v * param.scale : v;
            row[param?.key || `channel_${i}`] = scaled;
          });
        }

        return row;
      })
      .reverse();
  }, [logs, range, parameters]);

  const seriesKeys = useMemo(() => {
    if (parameters.length) return parameters.map((p) => p.key);
    if (chartData.length) {
      return Object.keys(chartData[0]).filter((k) => !['timestamp', 'label'].includes(k));
    }
    return [];
  }, [parameters, chartData]);

  return (
    <Card className={styles.chartCard}>
      <Card.Body>
        <div className={styles.chartHeader}>
          <h6 className={styles.chartTitle}>Historical Consumption</h6>
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
            <div className={styles.empty}>No historical data for this range.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {seriesKeys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={COLORS[i % COLORS.length]}
                    dot={false}
                    strokeWidth={2}
                    name={parameters.find((p) => p.key === key)?.label || key}
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
