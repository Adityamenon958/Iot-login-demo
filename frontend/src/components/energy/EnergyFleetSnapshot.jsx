import React from 'react';
import styles from './EnergyFleetSnapshot.module.css';

export default function EnergyFleetSnapshot({ snapshot }) {
  if (!snapshot) return null;

  const { reportingMeterCount, totalMeterCount, lastUpdated } = snapshot;

  return (
    <div className={styles.strip}>
      <span>
        Reporting: <strong>{reportingMeterCount ?? 0}</strong> / {totalMeterCount ?? 0} meters
      </span>
      {lastUpdated && (
        <span>
          Last updated:{' '}
          <strong>{new Date(lastUpdated).toLocaleString()}</strong>
        </span>
      )}
    </div>
  );
}
