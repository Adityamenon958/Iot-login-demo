import React from 'react';
import { Form } from 'react-bootstrap';
import { CHART_COLORS, formatMeterDisplayLabel } from './energyChartShared';
import styles from './EnergyChartLegendToggles.module.css';

export default function EnergyChartLegendToggles({
  chartSeries = [],
  visibleMeters,
  onToggle,
  searchQuery = '',
}) {
  const q = searchQuery.trim().toLowerCase();

  const filtered = chartSeries.filter((s) => {
    if (!q) return true;
    const hay = [s.meterId, s.machineName, s.siteName].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });

  if (!chartSeries.length) return null;

  return (
    <div className={styles.legend}>
      {filtered.map((s) => {
        const idx = chartSeries.findIndex((c) => c.meterId === s.meterId);
        const color = CHART_COLORS[idx % CHART_COLORS.length];
        const label = formatMeterDisplayLabel(s.meterId, s.machineName);
        return (
          <Form.Check
            key={s.meterId}
            type="checkbox"
            id={`legend-${s.meterId}`}
            className={styles.item}
            label={
              <span className={styles.label}>
                <span className={styles.swatch} style={{ background: color }} />
                {label}
              </span>
            }
            checked={visibleMeters.has(s.meterId)}
            onChange={() => onToggle(s.meterId)}
          />
        );
      })}
      {filtered.length === 0 && (
        <span className={styles.noMatch}>No meters match search</span>
      )}
    </div>
  );
}
