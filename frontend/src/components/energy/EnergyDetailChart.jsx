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
import styles from './EnergyDetailChart.module.css';

const RANGES = [
  { key: '15m', label: '15m' },
  { key: '1h', label: '1h' },
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
];

const SERIES_COLORS = {
  voltage: '#0d6efd',
  current: '#198754',
  activePower: '#fd7e14',
  energy: '#6f42c1',
};

const ENERGY_AXIS_KEYS = new Set(['energy']);

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

export default function EnergyDetailChart({ meterId }) {
  const [range, setRange] = useState('24h');
  const [chartMeta, setChartMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchChart = useCallback(async (showSpinner = true) => {
    if (!meterId) return;
    if (showSpinner) setLoading(true);
    try {
      const res = await axios.get('/api/energy-meter/meter-chart', {
        params: { meterId, range },
        withCredentials: true,
      });
      setChartMeta(res.data);
    } catch (err) {
      console.error('Meter chart fetch failed:', err);
      setChartMeta(null);
    } finally {
      setLoading(false);
    }
  }, [meterId, range]);

  useEffect(() => {
    fetchChart(true);
    const interval = setInterval(() => fetchChart(false), 30000);
    return () => clearInterval(interval);
  }, [fetchChart]);

  const parameters = chartMeta?.parameters || [];
  const points = chartMeta?.points || [];

  const chartData = useMemo(
    () =>
      points.map((pt) => ({
        timestamp: pt.timestamp,
        label: formatAxisLabel(pt.timestamp, range),
        ...pt.readings,
      })),
    [points, range]
  );

  const seriesKeys = useMemo(() => {
    if (parameters.length) return parameters.map((p) => p.key);
    if (chartData.length) {
      return Object.keys(chartData[0]).filter((k) => !['timestamp', 'label'].includes(k));
    }
    return [];
  }, [parameters, chartData]);

  const subtitle = buildSubtitle(chartMeta);

  const paramLabel = (key) => parameters.find((p) => p.key === key)?.label || key;
  const paramUnit = (key) => parameters.find((p) => p.key === key)?.unit || '';

  if (!meterId) return null;

  return (
    <Card className={styles.chartCard}>
      <Card.Body>
        <div className={styles.chartHeader}>
          <div>
            <h6 className={styles.chartTitle}>Historical Consumption</h6>
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
            <div className={styles.empty}>No historical data for this range.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  minTickGap={range === '7d' ? 48 : range === '24h' ? 32 : 16}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="energy"
                  orientation="left"
                  tick={{ fontSize: 10 }}
                  stroke={SERIES_COLORS.energy}
                  label={{ value: 'kWh', angle: -90, position: 'insideLeft', fontSize: 10 }}
                />
                <YAxis
                  yAxisId="instant"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  stroke="#6c757d"
                  label={{ value: 'V / A / kW', angle: 90, position: 'insideRight', fontSize: 10 }}
                />
                <Tooltip
                  labelFormatter={(_, payload) => {
                    const ts = payload?.[0]?.payload?.timestamp;
                    return ts ? formatSubtitleDate(ts) : '';
                  }}
                  formatter={(value, name) => {
                    const unit = paramUnit(name);
                    return [`${value}${unit ? ` ${unit}` : ''}`, paramLabel(name)];
                  }}
                />
                <Legend
                  formatter={(value) => paramLabel(value)}
                />
                {seriesKeys.map((key) => (
                  <Line
                    key={key}
                    yAxisId={ENERGY_AXIS_KEYS.has(key) ? 'energy' : 'instant'}
                    type="monotone"
                    dataKey={key}
                    stroke={SERIES_COLORS[key] || '#333'}
                    dot={false}
                    strokeWidth={2}
                    name={key}
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
