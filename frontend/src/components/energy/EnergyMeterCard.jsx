import React from 'react';
import { Card, Badge, Button } from 'react-bootstrap';
import { ChevronRight } from 'lucide-react';
import EnergyAlarmBadge from './EnergyAlarmBadge';
import attentionStyles from './energyAlarmAttention.module.css';
import { formatRelativeTime } from './energyAlarmConfig';
import styles from './EnergyMeterCard.module.css';

function MiniSparkline({ data = [], color = '#0d6efd' }) {
  if (!data.length) {
    return <span className={styles.noSpark}> </span>;
  }

  const w = 56;
  const h = 20;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min;

  let points;
  if (range === 0) {
    const midY = h / 2;
    points = `0,${midY} ${w},${midY}`;
  } else {
    points = data
      .map((v, i) => {
        const x = (i / Math.max(data.length - 1, 1)) * w;
        const y = h - ((v - min) / range) * (h - 4) - 2;
        return `${x},${y}`;
      })
      .join(' ');
  }

  return (
    <svg width={w} height={h} className={styles.sparkline} aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function EnergyMeterCard({ meter, onSelect, alarmInfo, attention }) {
  const {
    meterId,
    siteName,
    plantName,
    machineName,
    online,
    lastCommunication,
    currentPowerKw,
    todayConsumptionKwh,
    powerSparkline = [],
    energySparkline = [],
  } = meter;

  const openCount = alarmInfo?.count ?? attention?.count ?? 0;
  const borderSeverity = attention?.borderSeverity || alarmInfo?.highestSeverity;
  const pulse = attention?.pulse ?? false;
  const relativeTime = formatRelativeTime(
    attention?.latestTriggeredAt || alarmInfo?.latestTriggeredAt
  );

  const alarmBorderClass =
    openCount > 0 && borderSeverity === 'critical'
      ? attentionStyles.leftBorderCritical
      : openCount > 0 && borderSeverity === 'warning'
        ? attentionStyles.leftBorderWarning
        : '';

  return (
    <Card
      className={[
        styles.card,
        online ? styles.online : styles.offline,
        alarmBorderClass,
      ].filter(Boolean).join(' ')}
      onClick={() => onSelect(meterId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(meterId)}
    >
      <Card.Body>
        <div className={styles.cardHeader}>
          <h6 className={styles.meterName}>
            {meterId}
            {openCount > 0 && (
              <EnergyAlarmBadge
                severity={borderSeverity}
                count={openCount}
                pulse={pulse}
              />
            )}
          </h6>
          <Badge bg={online ? 'success' : 'secondary'}>{online ? 'ONLINE' : 'OFFLINE'}</Badge>
        </div>

        <div className={styles.meta}>
          {siteName && <div>{siteName}</div>}
          {(plantName || machineName) && (
            <div className={styles.breadcrumb}>
              {[plantName, machineName].filter(Boolean).join(' > ')}
            </div>
          )}
        </div>

        <div className={styles.readingsBlock}>
          <div className={styles.metricRow}>
            <div className={styles.metricText}>
              <small className="text-muted">Current Power</small>
              <div className={styles.readingValue}>
                {currentPowerKw != null ? `${currentPowerKw} kW` : '—'}
              </div>
            </div>
            <MiniSparkline data={powerSparkline} color="#0d6efd" />
          </div>
          <div className={styles.metricRow}>
            <div className={styles.metricText}>
              <small className="text-muted">Today&apos;s Consumption</small>
              <div className={styles.readingValue}>
                {todayConsumptionKwh != null
                  ? `${Number(todayConsumptionKwh).toFixed(2)} kWh`
                  : '—'}
              </div>
            </div>
            <MiniSparkline data={energySparkline} color="#198754" />
          </div>
        </div>

        <div className={styles.footer}>
          <small className="text-muted">
            {relativeTime && openCount > 0 ? (
              <>Alarm: {relativeTime}</>
            ) : (
              <>Last: {lastCommunication}</>
            )}
          </small>
          <Button variant="outline-primary" size="sm" className={styles.detailBtn}>
            View Details <ChevronRight size={14} />
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}
