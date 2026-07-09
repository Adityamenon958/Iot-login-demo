import React from 'react';
import { Col, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { Bell, HelpCircle } from 'lucide-react';
import attentionStyles from './energyAlarmAttention.module.css';
import styles from './EnergyAlarmKpiCard.module.css';

const ALARM_KPI_TOOLTIP =
  'Open = alarms not cleared yet. Today triggered = all alarms fired today (IST), including cleared ones.';

export default function EnergyAlarmKpiCard({ summary, onClick, pulse = false }) {
  if (!summary) return null;

  const openCount = summary.openCount ?? (summary.activeCount || 0) + (summary.acknowledgedCount || 0);
  const todayTriggered = summary.todayTriggeredCount ?? 0;
  const clickable = typeof onClick === 'function';
  const hasCritical = (summary.criticalCount ?? 0) > 0;
  const pulseClass = pulse
    ? hasCritical
      ? attentionStyles.pulseNewCritical
      : attentionStyles.pulseNewWarning
    : '';

  return (
    <Col xs={12} sm={6} lg={4} xl className={`d-flex ${styles.kpiCol}`}>
      <div
        className={[
          styles.kpiCard,
          clickable ? styles.clickable : '',
          openCount > 0 ? styles.hasOpen : '',
          openCount > 0 && hasCritical ? attentionStyles.borderCritical : '',
          openCount > 0 && !hasCritical ? attentionStyles.borderWarning : '',
          pulseClass,
        ].filter(Boolean).join(' ')}
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
        <OverlayTrigger
          placement="bottom"
          overlay={<Tooltip id="energy-alarm-kpi-tip">{ALARM_KPI_TOOLTIP}</Tooltip>}
        >
          <span
            className={styles.kpiHelp}
            aria-label="About Active Alarms"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <HelpCircle size={13} />
          </span>
        </OverlayTrigger>
        <div className={styles.kpiIcon}>
          <Bell size={15} />
        </div>
        <div className={styles.kpiLabel}>Alarms</div>
        <div className={styles.kpiValue}>{openCount}</div>
        <div className={styles.todayLine}>
          Today: <strong>{todayTriggered}</strong>
        </div>
        {clickable && <div className={styles.hint}>Tap for details</div>}
      </div>
    </Col>
  );
}
