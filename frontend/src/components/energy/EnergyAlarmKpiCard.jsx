import React from 'react';
import { Col } from 'react-bootstrap';
import { Bell } from 'lucide-react';
import styles from './EnergyAlarmKpiCard.module.css';

export default function EnergyAlarmKpiCard({ summary, onClick }) {
  if (!summary) return null;

  const openCount = summary.openCount ?? (summary.activeCount || 0) + (summary.acknowledgedCount || 0);
  const todayTriggered = summary.todayTriggeredCount ?? 0;
  const clickable = typeof onClick === 'function';

  return (
    <Col xs={12} sm={6} lg={4} xl={2} className="d-flex">
      <div
        className={`${styles.kpiCard} ${clickable ? styles.clickable : ''} ${openCount > 0 ? styles.hasOpen : ''}`}
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
        title={clickable ? 'View alarm details' : undefined}
      >
        <div className={styles.kpiIcon}>
          <Bell size={15} />
        </div>
        <div className={styles.kpiLabel}>Active Alarms</div>
        <div className={styles.kpiValue}>{openCount}</div>
        <div className={styles.todayLine}>
          Today (IST): <strong>{todayTriggered}</strong> triggered
        </div>
        {clickable && <div className={styles.hint}>Tap for details</div>}
      </div>
    </Col>
  );
}
