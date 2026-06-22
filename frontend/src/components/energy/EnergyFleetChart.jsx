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
import {
  CHART_COLORS,
  CHART_RANGES,
  formatAxisLabel,
  buildChartSubtitle,
  buildMultiSeriesChartData,
} from './energyChartShared';
import ChartMultiSeriesTooltip from './ChartMultiSeriesTooltip';
import styles from './EnergyFleetChart.module.css';

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

  const visibleSet = useMemo(
    () => new Set(chartSeries.map((s) => s.meterId)),
    [chartSeries]
  );

  const { chartData, meterIds } = useMemo(
    () => buildMultiSeriesChartData(chartSeries, visibleSet, range),
    [chartSeries, visibleSet, range]
  );

  const subtitle = buildChartSubtitle(chartMeta);

  return (
    <Card className={styles.chartCard}>
      <Card.Body>
        <div className={styles.chartHeader}>
          <div>
            <h6 className={styles.chartTitle}>Fleet Energy (kWh)</h6>
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
            <div className={styles.empty}>No chart data for this range yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={235}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis
                  dataKey="bucketTs"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(ts) => formatAxisLabel(new Date(Number(ts)), range)}
                  minTickGap={range === '7d' ? 48 : range === '24h' ? 32 : 16}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  shared
                  content={(props) => (
                    <ChartMultiSeriesTooltip
                      {...props}
                      meterIds={meterIds}
                      unit="kWh"
                      decimals={2}
                    />
                  )}
                />
                <Legend />
                {meterIds.map((id, i) => (
                  <Line
                    key={id}
                    type="monotone"
                    dataKey={id}
                    name={id}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    dot={false}
                    activeDot={{ r: 4 }}
                    strokeWidth={2}
                    connectNulls
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
