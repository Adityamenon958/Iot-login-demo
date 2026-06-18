import React from 'react';
import { CHART_COLORS } from './energyChartShared';
import styles from './EnergyMiniMultiSparkline.module.css';

export default function EnergyMiniMultiSparkline({
  chartSeries = [],
  hiddenMeterCount = 0,
  onlyMiniChart = true,
}) {
  const series = onlyMiniChart
    ? chartSeries.filter((s) => s.isIncludedInMiniChart !== false)
    : chartSeries;

  const hasPoints = series.some((s) => s.points?.length > 0);

  if (!hasPoints) {
    return <span className={styles.noData}>No recent data</span>;
  }

  const w = 120;
  const h = 32;

  const allValues = series.flatMap((s) => (s.points || []).map((p) => p.value));
  const max = Math.max(...allValues, 1);
  const min = Math.min(...allValues, 0);
  const valueRange = max - min || 1;

  return (
    <div className={styles.wrap}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={styles.svg}>
        {series.map((s) => {
          const pts = s.points || [];
          if (!pts.length) return null;
          const idx = chartSeries.findIndex((c) => c.meterId === s.meterId);
          const color = CHART_COLORS[idx % CHART_COLORS.length];
          const points = pts
            .map((pt, i) => {
              const x = (i / Math.max(pts.length - 1, 1)) * w;
              const y = h - ((pt.value - min) / valueRange) * h;
              return `${x},${y}`;
            })
            .join(' ');
          return (
            <polyline
              key={s.meterId}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              points={points}
            />
          );
        })}
      </svg>
      {hiddenMeterCount > 0 && (
        <span className={styles.moreLabel}>+{hiddenMeterCount} more meters</span>
      )}
    </div>
  );
}
