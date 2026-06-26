import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import { CHART_COLORS, formatMeterDisplayLabel } from './energyChartShared';
import styles from './EnergyDailyBarChart.module.css';

const DEFAULT_BAR_COLOR = '#6f42c1';
const PEAK_BAR_COLOR = '#d63384';

function formatHourTick(label) {
  if (!label) return '';
  const hour = Number(String(label).slice(0, 2));
  if (!Number.isFinite(hour)) return label;
  if (hour === 0) return '12a';
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return '12p';
  return `${hour - 12}p`;
}

function meterSeriesKey(meterId, index) {
  return `meter_${index}`;
}

function HourlyTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0]?.payload;
  if (!bucket) return null;

  const endHour = String((bucket.hour + 1) % 24).padStart(2, '0');
  const breakdown = bucket.byMeter || [];

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>
        {bucket.label} – {endHour}:00 IST
      </div>
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
        <div className={styles.tooltipRow}>Used this hour: {Number(bucket.kwh).toFixed(2)} kWh</div>
      )}
    </div>
  );
}

export default function EnergyHourlyBarChart({
  data = [],
  peakHourStart = null,
  height = 180,
}) {
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
        isPeak: peakHourStart != null && bucket.label === peakHourStart,
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
  }, [data, peakHourStart]);

  if (!hasUsage) {
    return (
      <div className={styles.wrap}>
        <div className={styles.chartTitle}>Today&apos;s Hourly Consumption</div>
        <div className={styles.chartSubtitle}>Each bar = kWh used in that hour (IST)</div>
        <div className={styles.empty}>No hourly usage recorded for today yet.</div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.chartTitle}>Today&apos;s Hourly Consumption</div>
      <div className={styles.chartSubtitle}>
        {useStacked
          ? 'Stacked bars show each meter’s share per hour (IST)'
          : 'Each bar = kWh used in that hour (IST)'}
      </div>
      <div className={styles.chartBody}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9 }}
              interval={2}
              tickFormatter={formatHourTick}
            />
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
            <Tooltip content={<HourlyTooltip />} />
            {useStacked ? (
              <>
                {meterSeries.map((s) => (
                  <Bar
                    key={s.seriesKey}
                    dataKey={s.seriesKey}
                    name={formatMeterDisplayLabel(s.meterId, s.machineName)}
                    stackId="hour"
                    fill={s.color}
                    radius={[0, 0, 0, 0]}
                    isAnimationActive={false}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </>
            ) : (
              <Bar dataKey="kwh" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {chartData.map((bucket) => (
                  <Cell
                    key={bucket.hour}
                    fill={bucket.isPeak ? PEAK_BAR_COLOR : DEFAULT_BAR_COLOR}
                  />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
