import React from 'react';
import styles from './EnergyChartRangePills.module.css';

export default function EnergyChartRangePills({ ranges, value, onChange }) {
  return (
    <div className={styles.pills}>
      {ranges.map((r) => (
        <button
          key={r.key}
          type="button"
          className={`${styles.pill} ${value === r.key ? styles.pillActive : ''}`}
          onClick={() => onChange(r.key)}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
