import React from 'react';
import styles from './EnergyAlarmBadge.module.css';

export default function EnergyAlarmBadge({ severity, count }) {
  if (!severity || !count) return null;

  const isCritical = severity === 'critical';

  return (
    <span
      className={`${styles.badge} ${isCritical ? styles.critical : styles.warning}`}
      title={`${count} open alarm${count > 1 ? 's' : ''} (${severity})`}
    >
      {count}
    </span>
  );
}
