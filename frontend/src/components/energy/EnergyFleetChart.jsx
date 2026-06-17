import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Spinner } from 'react-bootstrap';
import axios from 'axios';
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
  { key: '15m', label: '15m' },
  { key: '1h', label: '1h' },
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
];

const COLORS = ['#0d6efd', '#198754', '#fd7e14', '#6f42c1', '#dc3545', '#20c997'];

function formatAxisLabel(timestamp, range) {
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

function formatSubtitleDate(value) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildSubtitle(chartMeta) {
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

export default function EnergyFleetChart({ refreshKey = 0 }) {
  const [range, setRange] = useState('24h');
  const [chartMeta, setChartMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchChart = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await axios.get('/api/energy-meter/fleet-chart', {
        params: { range },
        withCredentials: true,
      });
      setChartMeta(res.data);
    } catch (err) {
      console.error('Fleet chart fetch failed:', err);
      setChartMeta(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchChart(true);
    const interval = setInterval(() => fetchChart(false), 30000);
    return () => clearInterval(interval);
  }, [fetchChart, refreshKey]);

  const chartSeries = chartMeta?.chartSeries || [];

  const chartData = useMemo(() => {
    const map = new Map();

    chartSeries.forEach((series) => {
      series.points.forEach((pt) => {
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

    return Array.from(map.values()).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
  }, [chartSeries, range]);

  const meterIds = chartSeries.map((s) => s.meterId);
  const subtitle = buildSubtitle(chartMeta);

  return (
    <Card className={styles.chartCard}>
      <Card.Body>
        <div className={styles.chartHeader}>
          <div>
            <h6 className={styles.chartTitle}>Fleet Energy (kWh)</h6>
            {subtitle && <p className={styles.chartSubtitle}>{subtitle}</p>}
          </div>
          <div className={styles.rangePills}>
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                className={`${styles.pill} ${range === r.key ? styles.pillActive : ''}`}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.chartWrap}>
          {loading && !chartData.length ? (
            <div className={styles.empty}>
              <Spinner animation="border" size="sm" className="me-2" />
              Loading chart…
            </div>
          ) : chartData.length === 0 ? (
            <div className={styles.empty}>No chart data for this range yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  minTickGap={range === '7d' ? 48 : range === '24h' ? 32 : 16}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(_, payload) => {
                    const ts = payload?.[0]?.payload?.timestamp;
                    return ts ? formatSubtitleDate(ts) : '';
                  }}
                />
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
