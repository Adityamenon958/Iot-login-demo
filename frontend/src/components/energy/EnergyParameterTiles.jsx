import React from 'react';
import { Row, Col } from 'react-bootstrap';
import styles from './EnergyParameterTiles.module.css';

export default function EnergyParameterTiles({ readings = {}, parameters = [] }) {
  const entries = parameters.length
    ? parameters.map((p) => ({
        key: p.key,
        label: p.label,
        unit: p.unit,
        value: readings[p.key],
      }))
    : Object.entries(readings).map(([key, value]) => ({
        key,
        label: key,
        unit: '',
        value,
      }));

  if (!entries.length) {
    return (
      <div className={styles.empty}>
        No mapped parameters yet. Raw payload is stored for troubleshooting.
      </div>
    );
  }

  return (
    <Row className="g-2 mb-2">
      {entries.map(({ key, label, unit, value }) => (
        <Col key={key} xs={6} md={4} lg={3}>
          <div className={styles.tile}>
            <div className={styles.tileLabel}>{label}</div>
            <div className={styles.tileValue}>
              {value != null ? value : '—'}
              {unit && <span className={styles.unit}> {unit}</span>}
            </div>
          </div>
        </Col>
      ))}
    </Row>
  );
}
