import React from 'react';
import { Bell } from 'lucide-react';
import attentionStyles from './energyAlarmAttention.module.css';
import styles from './EnergyAlarmFab.module.css';

export default function EnergyAlarmFab({
  activeCount = 0,
  pulse = false,
  severity = 'warning',
  onClick,
}) {
  if (activeCount <= 0) return null;

  const pulseClass =
    pulse && severity === 'critical'
      ? attentionStyles.pulseNewCritical
      : pulse
        ? attentionStyles.pulseNewWarning
        : '';

  return (
    <button
      type="button"
      className={`${styles.fab} ${pulseClass} ${
        severity === 'critical' ? styles.critical : styles.warning
      }`}
      onClick={onClick}
      title={`${activeCount} active alarm${activeCount !== 1 ? 's' : ''}`}
      aria-label={`View ${activeCount} active alarms`}
    >
      <Bell size={22} />
      <span className={styles.badge}>{activeCount}</span>
    </button>
  );
}
