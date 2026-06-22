import React from 'react';
import { Row, Col } from 'react-bootstrap';
import { VALUE_DECIMALS } from './meterParameterConfig';
import styles from './EnergyParameterTiles.module.css';

function formatTileValue(key, value, unit) {
  if (value == null) return '—';
  const decimals = VALUE_DECIMALS[key] ?? 2;
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toFixed(decimals);
}

export default function EnergyParameterTiles({ readings = {}, parameters = [], onParameterClick }) {
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

  const clickable = typeof onParameterClick === 'function';

  return (
    <Row className="g-2 mb-2">
      {entries.map(({ key, label, unit, value }) => (
        <Col key={key} xs={6} md={4} lg={3}>
          <div
            className={`${styles.tile} ${clickable ? styles.clickable : ''}`}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onParameterClick(key) : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onParameterClick(key);
                    }
                  }
                : undefined
            }
          >
            <div className={styles.tileLabel}>{label}</div>
            <div className={styles.tileValue}>
              {formatTileValue(key, value, unit)}
              {unit && value != null && <span className={styles.unit}> {unit}</span>}
            </div>
            {clickable && <div className={styles.hint}>Tap for details</div>}
          </div>
        </Col>
      ))}
    </Row>
  );
}
