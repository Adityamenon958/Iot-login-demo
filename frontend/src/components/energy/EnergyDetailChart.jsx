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
import { CHART_RANGES, formatSubtitleDate, buildChartSubtitle } from './energyChartShared';
import styles from './EnergyDetailChart.module.css';

const SERIES_COLORS = {
  voltage: '#0d6efd',
  current: '#198754',
  activePower: '#fd7e14',
  energy: '#6f42c1',
  powerFactor: '#dc3545',
  frequency: '#20c997',
};

const ENERGY_AXIS_KEYS = new Set(['energy']);

const VALUE_DECIMALS = {
  voltage: 1,
  current: 2,
  activePower: 2,
  energy: 2,
  powerFactor: 2,
  frequency: 2,
};

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

function DetailChartTooltip({ active, payload, parameters = [] }) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  const paramLabel = (key) => parameters.find((p) => p.key === key)?.label || key;
  const paramUnit = (key) => parameters.find((p) => p.key === key)?.unit || '';

  const items = payload.filter((entry) => entry.value != null && entry.dataKey);

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>
        {row.timestamp ? formatSubtitleDate(row.timestamp) : ''}
      </div>
      {items.map((entry) => {
        const key = entry.dataKey;
        const decimals = VALUE_DECIMALS[key] ?? 2;
        const unit = paramUnit(key);
        const text = `${Number(entry.value).toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
        return (
          <div key={key} className={styles.tooltipRow} style={{ color: entry.color }}>
            {paramLabel(key)} : {text}
          </div>
        );
      })}
    </div>
  );
}

export default function EnergyDetailChart({ meterId, refreshKey = 0 }) {
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
  }, [fetchChart, refreshKey]);

  const parameters = chartMeta?.parameters || [];
  const points = chartMeta?.points || [];

  const chartData = useMemo(
    () =>
      points.map((pt) => ({
        timestamp: pt.timestamp,
        timeMs: new Date(pt.timestamp).getTime(),
        ...pt.readings,
      })),
    [points]
  );

  const timeDomain = useMemo(() => {
    if (!chartData.length) return ['dataMin', 'dataMax'];
    const times = chartData.map((d) => d.timeMs).filter(Number.isFinite);
    if (!times.length) return ['dataMin', 'dataMax'];
    return [Math.min(...times), Math.max(...times)];
  }, [chartData]);

  const seriesKeys = useMemo(() => {
    if (parameters.length) return parameters.map((p) => p.key);
    if (chartData.length) {
      return Object.keys(chartData[0]).filter((k) => !['timestamp', 'timeMs'].includes(k));
    }
    return [];
  }, [parameters, chartData]);

  const subtitle = buildChartSubtitle(chartMeta);

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
            {CHART_RANGES.map((r) => (
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
              <LineChart
                data={chartData}
                margin={{ top: 36, right: 16, left: 4, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis
                  dataKey="timeMs"
                  type="number"
                  scale="time"
                  domain={timeDomain}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(ms) => formatAxisLabel(ms, range)}
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
                <Legend
                  verticalAlign="top"
                  align="center"
                  wrapperStyle={{ fontSize: 11, paddingBottom: 4 }}
                  formatter={(value) =>
                    parameters.find((p) => p.key === value)?.label || value
                  }
                />
                <Tooltip
                  shared
                  allowEscapeViewBox={{ x: true, y: true }}
                  wrapperStyle={{ zIndex: 20, outline: 'none' }}
                  content={(props) => (
                    <DetailChartTooltip {...props} parameters={parameters} />
                  )}
                />
                {seriesKeys.map((key) => (
                  <Line
                    key={key}
                    yAxisId={ENERGY_AXIS_KEYS.has(key) ? 'energy' : 'instant'}
                    type="monotone"
                    dataKey={key}
                    stroke={SERIES_COLORS[key] || '#333'}
                    dot={false}
                    activeDot={{ r: 3 }}
                    strokeWidth={2}
                    name={key}
                    isAnimationActive={false}
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
