import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { CHART_COLORS, formatMeterDisplayLabel } from './energyChartShared';
import styles from './EnergyDailyBarChart.module.css';

const DEFAULT_BAR_COLOR = '#6f42c1';

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function meterSeriesKey(meterId, index) {
  return `meter_${index}`;
}

function DailyTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0]?.payload;
  if (!bucket) return null;

  const breakdown = bucket.byMeter || [];

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{bucket.date}</div>
      <div className={styles.tooltipTotal}>
        Total: <strong>{Number(bucket.kwh).toFixed(2)} kWh</strong>
      </div>
      {breakdown.length > 0 ? (
        <ul className={styles.tooltipList}>
          {breakdown.map((row) => (
            <li key={row.meterId || row.machineName}>
              {formatMeterDisplayLabel(row.meterId, row.machineName)}:{' '}
              <strong>{Number(row.kwh).toFixed(2)} kWh</strong>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.tooltipRow}>Used this day: {Number(bucket.kwh).toFixed(2)} kWh</div>
      )}
    </div>
  );
}

export default function EnergyDailyBarChart({ data = [], height = 200 }) {
  const hasUsage = data.some((bucket) => Number(bucket.kwh) > 0);

  const { chartData, meterSeries, useStacked } = useMemo(() => {
    const seriesMap = new Map();
    data.forEach((bucket) => {
      (bucket.byMeter || []).forEach((row) => {
        const id = row.meterId ?? row.machineName ?? 'meter';
        if (!seriesMap.has(id)) {
          seriesMap.set(id, {
            meterId: row.meterId,
            machineName: row.machineName || row.meterId || 'Meter',
          });
        }
      });
    });

    const series = Array.from(seriesMap.entries()).map(([id, meta], index) => ({
      ...meta,
      seriesKey: meterSeriesKey(id, index),
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));

    const stacked = series.length > 1;
    const rows = data.map((bucket) => {
      const row = {
        ...bucket,
        label: formatDateLabel(bucket.date),
      };
      series.forEach((s) => {
        const match = (bucket.byMeter || []).find((m) => {
          const mid = m.meterId ?? m.machineName ?? 'meter';
          const sid = s.meterId ?? s.machineName ?? 'meter';
          return mid === sid;
        });
        row[s.seriesKey] = match?.kwh ?? 0;
      });
      return row;
    });

    return { chartData: rows, meterSeries: series, useStacked: stacked };
  }, [data]);

  if (!data.length || !hasUsage) {
    return <div className={styles.empty}>No daily data for this period.</div>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.chartTitle}>Daily Consumption</div>
      <div className={styles.chartSubtitle}>
        {useStacked
          ? 'Stacked bars show each meter’s share per day (IST)'
          : 'Each bar = kWh used that day (IST)'}
      </div>
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
            <Tooltip content={<DailyTooltip />} />
            {useStacked ? (
              <>
                {meterSeries.map((s) => (
                  <Bar
                    key={s.seriesKey}
                    dataKey={s.seriesKey}
                    name={formatMeterDisplayLabel(s.meterId, s.machineName)}
                    stackId="day"
                    fill={s.color}
                    radius={[0, 0, 0, 0]}
                    isAnimationActive={false}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </>
            ) : (
              <Bar dataKey="kwh" fill={DEFAULT_BAR_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
