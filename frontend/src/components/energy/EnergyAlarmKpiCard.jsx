import React from 'react';
import { Col } from 'react-bootstrap';
import { Bell } from 'lucide-react';
import styles from './EnergyAlarmKpiCard.module.css';

export default function EnergyAlarmKpiCard({ summary, onClick }) {
  if (!summary) return null;

  const openCount = summary.openCount ?? (summary.activeCount || 0) + (summary.acknowledgedCount || 0);
  const critical = summary.criticalCount || 0;
  const warning = summary.warningCount || 0;
  const clickable = typeof onClick === 'function' && openCount > 0;

  return (
    <Col xs={12} sm={6} lg={4} xl={2}>
      <div
        className={`${styles.kpiCard} ${clickable ? styles.clickable : ''} ${critical > 0 ? styles.hasCritical : ''}`}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? onClick : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
      >
        <div className={styles.kpiIcon}>
          <Bell size={18} />
        </div>
        <div className={styles.kpiLabel}>Active Alarms</div>
        <div className={styles.kpiValue}>{openCount}</div>
        <div className={styles.breakdown}>
          <span className={styles.critical}>Critical: {critical}</span>
          <span className={styles.sep}>·</span>
          <span className={styles.warning}>Warning: {warning}</span>
        </div>
        {clickable && <div className={styles.hint}>Tap to view alarms</div>}
      </div>
    </Col>
  );
}
