import React from 'react';
import { Card, Badge, Button } from 'react-bootstrap';
import { ChevronRight } from 'lucide-react';
import styles from './EnergyMeterCard.module.css';

function MiniSparkline({ data = [] }) {
  if (!data.length) {
    return <span className={styles.noData}>No recent data</span>;
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 56;
  const h = 20;
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} className={styles.sparkline}>
      <polyline fill="none" stroke="#0d6efd" strokeWidth="2" points={points} />
    </svg>
  );
}

export default function EnergyMeterCard({ meter, onSelect }) {
  const {
    meterId,
    siteName,
    plantName,
    machineName,
    online,
    lastCommunication,
    latestReading,
    sparkline,
  } = meter;

  return (
    <Card
      className={`${styles.card} ${online ? styles.online : styles.offline}`}
      onClick={() => onSelect(meterId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(meterId)}
    >
      <Card.Body>
        <div className={styles.cardHeader}>
          <h6 className={styles.meterName}>{meterId}</h6>
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

        <div className={styles.readingRow}>
          <div>
            <small className="text-muted">Latest reading</small>
            <div className={styles.readingValue}>
              {latestReading
                ? `${latestReading.label || latestReading.key}: ${latestReading.value}${latestReading.unit ? ` ${latestReading.unit}` : ''}`
                : '—'}
            </div>
          </div>
          <MiniSparkline data={sparkline} />
        </div>

        <div className={styles.footer}>
          <small className="text-muted">Last: {lastCommunication}</small>
          <Button variant="outline-primary" size="sm" className={styles.detailBtn}>
            View Details <ChevronRight size={14} />
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}
