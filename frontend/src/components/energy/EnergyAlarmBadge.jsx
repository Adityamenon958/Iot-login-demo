import React from 'react';
import attentionStyles from './energyAlarmAttention.module.css';
import styles from './EnergyAlarmBadge.module.css';

export default function EnergyAlarmBadge({ severity, count, pulse = false }) {
  if (!severity || !count) return null;

  const isCritical = severity === 'critical';
  const pulseClass = pulse
    ? isCritical
      ? attentionStyles.pulseNewCritical
      : attentionStyles.pulseNewWarning
    : '';

  return (
    <span
      className={[
        styles.badge,
        isCritical ? styles.critical : styles.warning,
        pulseClass,
      ].filter(Boolean).join(' ')}
      title={`${count} open alarm${count > 1 ? 's' : ''} (${severity})`}
    >
      {count}
    </span>
  );
}
