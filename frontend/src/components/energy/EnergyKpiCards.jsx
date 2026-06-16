import React from 'react';
import { Row, Col, Badge } from 'react-bootstrap';
import { Activity, Wifi, WifiOff, Clock } from 'lucide-react';
import styles from './EnergyKpiCards.module.css';

const KPI_CONFIG = [
  { key: 'totalMeters', label: 'Total Meters', icon: Activity, variant: 'primary' },
  { key: 'onlineMeters', label: 'Online Meters', icon: Wifi, variant: 'success' },
  { key: 'offlineMeters', label: 'Offline Meters', icon: WifiOff, variant: 'warning' },
  { key: 'lastCommunicationStatus', label: 'Last Communication', icon: Clock, variant: 'info', isText: true },
];

export default function EnergyKpiCards({ kpis }) {
  if (!kpis) return null;

  return (
    <Row className="g-3 mb-4">
      {KPI_CONFIG.map(({ key, label, icon: Icon, variant, isText }) => (
        <Col key={key} xs={6} lg={3}>
          <div className={`${styles.kpiCard} ${styles[variant]}`}>
            <div className={styles.kpiIcon}>
              <Icon size={20} />
            </div>
            <div className={styles.kpiLabel}>{label}</div>
            <div className={styles.kpiValue}>
              {isText ? (
                <span className={styles.kpiText}>{kpis[key] || 'No data yet'}</span>
              ) : (
                kpis[key] ?? 0
              )}
            </div>
            {key === 'onlineMeters' && (
              <Badge bg="success" className={styles.liveBadge}>Live</Badge>
            )}
          </div>
        </Col>
      ))}
    </Row>
  );
}
