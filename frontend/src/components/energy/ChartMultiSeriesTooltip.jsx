import React from 'react';
import { CHART_COLORS, formatSubtitleDate } from './energyChartShared';
import styles from './ChartMultiSeriesTooltip.module.css';

export default function ChartMultiSeriesTooltip({
  active,
  payload,
  meterIds = [],
  unit = '',
  decimals = 2,
}) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{formatSubtitleDate(row.timestamp)}</div>
      {meterIds.map((meterId, idx) => {
        const val = row[meterId];
        const color = CHART_COLORS[idx % CHART_COLORS.length];
        const text = val != null
          ? `${Number(val).toFixed(decimals)}${unit ? ` ${unit}` : ''}`
          : '—';
        return (
          <div key={meterId} className={styles.tooltipRow} style={{ color }}>
            {meterId} : {text}
          </div>
        );
      })}
    </div>
  );
}
