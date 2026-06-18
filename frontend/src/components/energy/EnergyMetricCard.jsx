import React from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import { HelpCircle } from 'lucide-react';
import { HEALTH_COLORS } from './electricalHealthMetrics';
import { formatRangeValue } from './energyChartShared';
import EnergyMiniMultiSparkline from './EnergyMiniMultiSparkline';
import styles from './EnergyMetricCard.module.css';

function getHealthClass(healthStatus) {
  const map = {
    healthy: styles.cardHealthy,
    warning: styles.cardWarning,
    critical: styles.cardCritical,
    unknown: styles.cardUnknown,
  };
  return map[healthStatus] || styles.cardUnknown;
}

function getAlertStyle(healthStatus) {
  return { color: HEALTH_COLORS[healthStatus]?.text || HEALTH_COLORS.unknown.text };
}

export default function EnergyMetricCard({ metricDef, summary, onClick }) {
  const Icon = metricDef.icon;
  const healthStatus = summary?.healthStatus || 'unknown';
  const healthClass = getHealthClass(healthStatus);

  let headline = 'No data yet';
  let subline = null;

  if (summary?.cardDisplayMode === 'highestLoad' && summary?.highestLoad) {
    headline = `${Number(summary.highestLoad.value).toFixed(metricDef.decimals)} ${summary.highestLoad.unit}`;
    subline = summary.highestLoad.displayName || summary.highestLoad.meterId;
  } else if (summary?.latestRange) {
    headline = formatRangeValue(summary.latestRange, metricDef.unit, metricDef.decimals);
  }

  const alertLine = summary?.alertSummary;
  const showAlert = metricDef.statusRules !== 'none' && alertLine;

  return (
    <div
      className={`${styles.card} ${healthClass}`}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      role="button"
      tabIndex={0}
      aria-label={`Open ${metricDef.label} details`}
    >
      {metricDef.tooltip && (
        <OverlayTrigger
          placement="bottom"
          overlay={(
            <Tooltip id={`eh-tip-${metricDef.key}`}>{metricDef.tooltip}</Tooltip>
          )}
        >
          <span
            className={styles.cardHelp}
            aria-label={`About ${metricDef.label}`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <HelpCircle size={14} />
          </span>
        </OverlayTrigger>
      )}
      <div className={styles.header}>
        <Icon size={16} className={styles.icon} />
        <span className={styles.label}>{metricDef.label}</span>
      </div>

      {summary?.cardDisplayMode === 'highestLoad' && summary?.highestLoad && (
        <div className={styles.highestLabel}>Highest Load</div>
      )}

      <div className={styles.value}>{headline}</div>

      {subline && <div className={styles.subline}>{subline}</div>}

      {showAlert && (
        <div className={styles.alertLine} style={getAlertStyle(healthStatus)}>
          {healthStatus === 'healthy' ? '✓ ' : '⚠ '}
          {alertLine}
        </div>
      )}

      <div className={styles.sparkline}>
        <EnergyMiniMultiSparkline
          chartSeries={summary?.chartSeries || []}
          hiddenMeterCount={summary?.hiddenMeterCount || 0}
        />
      </div>
    </div>
  );
}
