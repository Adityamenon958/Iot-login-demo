import React from 'react';
import { Row, Col } from 'react-bootstrap';
import EnergyComparisonBadge from './EnergyComparisonBadge';
import styles from './EnergyInsightStatGrid.module.css';

function formatValue(value, unit, decimals = 2) {
  if (value == null) return '—';
  const text = Number(value).toFixed(decimals);
  return unit ? `${text} ${unit}` : text;
}

export default function EnergyInsightStatGrid({ items = [] }) {
  if (!items.length) return null;

  return (
    <Row className="g-2">
      {items.map((item) => (
        <Col key={item.key} xs={6} md={4} lg={3}>
          <div className={styles.stat}>
            <div className={styles.labelRow}>
              <div className={styles.label}>{item.label}</div>
              {item.dateHint && <div className={styles.dateHint}>{item.dateHint}</div>}
            </div>
            <div className={styles.value}>
              {formatValue(item.value, item.unit, item.decimals ?? 2)}
              {item.comparison && (
                <EnergyComparisonBadge comparison={item.comparison} labelKey={item.comparisonKey} />
              )}
            </div>
            {item.sublabel && <div className={styles.sublabel}>{item.sublabel}</div>}
          </div>
        </Col>
      ))}
    </Row>
  );
}
