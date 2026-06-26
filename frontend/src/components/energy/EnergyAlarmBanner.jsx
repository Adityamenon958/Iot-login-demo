import React from 'react';
import { Button, Form } from 'react-bootstrap';
import { AlertTriangle } from 'lucide-react';
import attentionStyles from './energyAlarmAttention.module.css';
import styles from './EnergyAlarmBanner.module.css';

export default function EnergyAlarmBanner({
  banner,
  summary,
  soundEnabled,
  onToggleSound,
  onViewAlarms,
}) {
  const openCount = banner?.openCount ?? summary?.openCount ?? 0;
  if (openCount <= 0) return null;

  const activeCritical = banner?.activeCriticalCount ?? 0;
  const activeWarning = banner?.activeWarningCount ?? 0;
  const acknowledgedOnly = (summary?.acknowledgedCount ?? 0) > 0 && (summary?.activeCount ?? 0) === 0;
  const isCritical = (banner?.criticalCount ?? summary?.criticalCount ?? 0) > 0;

  const parts = [];
  if (activeCritical > 0) parts.push(`${activeCritical} Critical`);
  if (activeWarning > 0) parts.push(`${activeWarning} Warning`);
  const activeLine = parts.length
    ? `${parts.join(' · ')} active`
    : `${openCount} open alarm${openCount !== 1 ? 's' : ''}`;

  return (
    <div
      className={`${styles.banner} ${attentionStyles.stickyBanner} ${
        isCritical ? styles.critical : styles.warning
      }`}
      role="alert"
    >
      <div className={styles.content}>
        <AlertTriangle size={18} className={styles.icon} />
        <div>
          <div className={styles.primary}>{activeLine}</div>
          {acknowledgedOnly && (
            <div className={styles.secondary}>
              {summary.acknowledgedCount} acknowledged, still open
            </div>
          )}
          {!acknowledgedOnly && (summary?.acknowledgedCount ?? 0) > 0 && (
            <div className={styles.secondary}>
              {summary.acknowledgedCount} acknowledged, still open
            </div>
          )}
        </div>
      </div>
      <div className={styles.actions}>
        <Form.Check
          type="switch"
          id="energy-alarm-sound"
          className={styles.soundToggle}
          label="Alarm sound"
          checked={soundEnabled}
          onChange={(e) => onToggleSound?.(e.target.checked)}
        />
        <Button size="sm" variant={isCritical ? 'danger' : 'warning'} onClick={onViewAlarms}>
          View alarms
        </Button>
      </div>
    </div>
  );
}
