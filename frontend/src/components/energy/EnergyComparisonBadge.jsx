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

  // ✅ For consumption: less usage = good (green), more usage = bad (red)
  const toneClass =
    direction === 'up' ? styles.down : direction === 'down' ? styles.up : styles.flat;

  return (
    <span className={`${styles.badge} ${toneClass}`}>
      {text}
      {hint && <span className={styles.hint}> {hint}</span>}
    </span>
  );
}
