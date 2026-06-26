import React from 'react';
import styles from './EnergyFleetStatusIndicator.module.css';

const STATUS_CONFIG = {
  normal: { label: 'System Normal', className: styles.normal },
  warning: { label: 'Warning Active', className: styles.warning },
  critical: { label: 'Critical Active', className: styles.critical },
};

export default function EnergyFleetStatusIndicator({ fleetStatus = 'normal' }) {
  const config = STATUS_CONFIG[fleetStatus] || STATUS_CONFIG.normal;

  return (
    <div className={`${styles.indicator} ${config.className}`} title="Fleet alarm system status">
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>{config.label}</span>
    </div>
  );
}
