import React from 'react';
import styles from './DeviceInfoCard.module.css';

function displayOrDash(value) {
  if (value == null) return '—';
  const text = String(value).trim();
  return text === '' ? '—' : text;
}

/**
 * ✅ Demo-only device summary — resilient when payload has no device fields
 */
export default function DeviceInfoCard({ device, connectionLabel, connectionTone }) {
  const name = displayOrDash(device?.deviceName);
  const id = displayOrDash(device?.deviceId);
  const communication = displayOrDash(device?.communication);
  const source = displayOrDash(device?.source);

  return (
    <section className={styles.card} aria-label="Device information">
      <h2 className={styles.cardTitle}>Device Information</h2>
      <dl className={styles.grid}>
        <div className={styles.field}>
          <dt>Device Name</dt>
          <dd>{name}</dd>
        </div>
        <div className={styles.field}>
          <dt>Device ID</dt>
          <dd className={styles.mono}>{id}</dd>
        </div>
        <div className={styles.field}>
          <dt>Communication</dt>
          <dd>{communication}</dd>
        </div>
        <div className={styles.field}>
          <dt>Source</dt>
          <dd>{source}</dd>
        </div>
        <div className={styles.field}>
          <dt>Connection Status</dt>
          <dd>
            <span
              className={`${styles.statusPill} ${styles[connectionTone] || styles.waiting}`}
            >
              {connectionLabel}
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
