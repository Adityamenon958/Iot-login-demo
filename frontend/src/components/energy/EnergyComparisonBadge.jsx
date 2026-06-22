import React from 'react';
import styles from './EnergyComparisonBadge.module.css';

const LABELS = {
  todayVsYesterday: 'vs yesterday',
  weekVsPreviousWeek: 'vs prev week',
  monthVsPreviousMonth: 'vs prev month',
};

export default function EnergyComparisonBadge({ comparison, labelKey }) {
  if (!comparison || comparison.deltaPct == null) return null;

  const { deltaPct, direction } = comparison;
  const sign = direction === 'up' ? '+' : direction === 'down' ? '' : '';
  const text = `${sign}${deltaPct}%`;
  const hint = labelKey ? LABELS[labelKey] || labelKey : '';

  return (
    <span
      className={`${styles.badge} ${
        direction === 'up' ? styles.up : direction === 'down' ? styles.down : styles.flat
      }`}
    >
      {text}
      {hint && <span className={styles.hint}> {hint}</span>}
    </span>
  );
}
