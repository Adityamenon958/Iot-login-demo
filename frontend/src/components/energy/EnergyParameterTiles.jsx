import React from 'react';
import { Row, Col } from 'react-bootstrap';
import { VALUE_DECIMALS } from './meterParameterConfig';
import attentionStyles from './energyAlarmAttention.module.css';
import styles from './EnergyParameterTiles.module.css';

function formatTileValue(key, value, unit) {
  if (value == null) return '—';
  const decimals = VALUE_DECIMALS[key] ?? 2;
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toFixed(decimals);
}

function formatMinMax(key, minMax, unit) {
  if (!minMax || minMax.min == null || minMax.max == null) return null;
  const decimals = VALUE_DECIMALS[key] ?? 2;
  const min = Number(minMax.min).toFixed(decimals);
  const max = Number(minMax.max).toFixed(decimals);
  const suffix = unit ? ` ${unit}` : '';
  return `24h min ${min}${suffix} · max ${max}${suffix}`;
}

export default function EnergyParameterTiles({
  readings = {},
  parameters = [],
  parameterStats24h = null,
  onParameterClick,
  suffix = null,
  highlightedKeys = [],
  highlightSeverity = 'warning',
}) {
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

  const statsMap = parameterStats24h?.stats || {};
  const frequencyIndex = entries.findIndex((entry) => entry.key === 'frequency');

  const highlightSet = new Set(highlightedKeys);
  const isCriticalHighlight = highlightSeverity === 'critical';

  const renderParameterTile = ({ key, label, unit, value }) => {
    const minMaxLabel = formatMinMax(key, statsMap[key], unit);
    const isAlarmTile = highlightSet.has(key);
    const tileClass = [
      styles.tile,
      clickable ? styles.clickable : '',
      isAlarmTile && isCriticalHighlight ? attentionStyles.tileAlarmCritical : '',
      isAlarmTile && !isCriticalHighlight ? attentionStyles.tileAlarmWarning : '',
    ].filter(Boolean).join(' ');

    return (
      <Col key={key} xs={6} md={4} lg={3}>
        <div
          className={tileClass}
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
          {minMaxLabel && <div className={styles.minMax}>{minMaxLabel}</div>}
          {isAlarmTile && (
            <span
              className={`${attentionStyles.tileAlarmChip} ${
                isCriticalHighlight
                  ? attentionStyles.tileAlarmChipCritical
                  : attentionStyles.tileAlarmChipWarning
              }`}
            >
              Alarm
            </span>
          )}
          {clickable && <div className={styles.hint}>Tap for details</div>}
        </div>
      </Col>
    );
  };

  return (
    <Row className="g-2 mb-2">
      {entries.map((entry, index) => (
        <React.Fragment key={entry.key}>
          {renderParameterTile(entry)}
          {suffix && frequencyIndex >= 0 && index === frequencyIndex && (
            <Col xs={6} md={4} lg={3}>
              {suffix}
            </Col>
          )}
        </React.Fragment>
      ))}
      {suffix && frequencyIndex < 0 && (
        <Col xs={6} md={4} lg={3}>
          {suffix}
        </Col>
      )}
    </Row>
  );
}
