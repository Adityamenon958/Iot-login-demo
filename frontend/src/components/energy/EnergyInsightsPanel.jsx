import React from 'react';
import { Row, Col, Badge } from 'react-bootstrap';
import styles from './EnergyInsightsPanel.module.css';

function formatTimestamp(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }) {
  const map = { healthy: 'success', warning: 'warning', critical: 'danger', unknown: 'secondary' };
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  return <Badge bg={map[status] || 'secondary'}>{label}</Badge>;
}

function PenaltyRiskBadge({ risk }) {
  if (!risk) return '—';
  const map = { Low: 'success', Medium: 'warning', High: 'danger' };
  return <Badge bg={map[risk] || 'secondary'}>{risk}</Badge>;
}

function InsightValue({ item }) {
  if (item.type === 'status') return <StatusBadge status={item.value} />;
  if (item.type === 'penaltyRisk') return <PenaltyRiskBadge risk={item.value} />;
  if (item.type === 'timestamp') return formatTimestamp(item.value);

  if (item.type === 'hourRange' && item.value) {
    return (
      <>
        <span className={styles.primaryValue}>
          {item.value.start} – {item.value.end}
        </span>
        <span className={styles.secondaryValue}>{Number(item.value.kwh).toFixed(1)} kWh</span>
      </>
    );
  }

  if (item.type === 'dayConsumption' && item.value) {
    return (
      <>
        <span className={styles.primaryValue}>{item.value.date}</span>
        <span className={styles.secondaryValue}>{Number(item.value.kwh).toFixed(1)} kWh</span>
      </>
    );
  }

  const text = item.value != null ? item.value : '—';
  return (
    <>
      <span className={styles.primaryValue}>{text}</span>
      {item.unit && item.value != null && (
        <span className={styles.secondaryValue}>{item.unit}</span>
      )}
    </>
  );
}

export default function EnergyInsightsPanel({ items = [] }) {
  if (!items.length) return null;

  return (
    <div className={styles.panel}>
      <h6 className={styles.title}>Operational Insights</h6>
      <Row className="g-2">
        {items.map((item) => (
          <Col key={item.key} xs={12} sm={6} md={4} lg={3}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>{item.label}</div>
              <div className={styles.cardValue}>
                <InsightValue item={item} />
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </div>
  );
}
