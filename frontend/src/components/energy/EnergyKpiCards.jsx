import React from 'react';
import { Row, Col, OverlayTrigger, Tooltip, Badge } from 'react-bootstrap';
import {
  Zap,
  BatteryCharging,
  HelpCircle,
  Gauge,
  Activity,
  Radio,
} from 'lucide-react';
import styles from './EnergyKpiCards.module.css';

const KPI_CONFIG = [
  {
    key: 'currentPowerConsumption',
    label: 'Current Power',
    icon: Zap,
    variant: 'power',
    unitKey: 'currentPowerUnit',
    decimals: 1,
    tooltip: 'Total kW from online meters right now.',
  },
  {
    key: 'todayEnergyConsumption',
    label: "Today's Consumption",
    icon: BatteryCharging,
    variant: 'energy',
    unitKey: 'todayEnergyUnit',
    decimals: 2,
    tooltip: 'Fleet kWh used today (IST midnight to now).',
  },
  {
    key: 'averagePowerFactor',
    label: 'Avg Power Factor',
    icon: Gauge,
    variant: 'pf',
    decimals: 2,
    showPfBadge: true,
    tooltip: 'Average latest PF across visible meters.',
  },
  {
    key: 'averageVoltage',
    label: 'Avg Voltage',
    icon: Activity,
    variant: 'voltage',
    unitKey: 'averageVoltageUnit',
    decimals: 1,
    tooltip: 'Average latest voltage across visible meters.',
  },
  {
    key: 'averageFrequency',
    label: 'Avg Frequency',
    icon: Radio,
    variant: 'frequency',
    unitKey: 'averageFrequencyUnit',
    decimals: 2,
    tooltip: 'Average latest frequency across visible meters.',
  },
];

function formatKpiText(kpis, { key, unitKey, decimals }) {
  const value = kpis[key];
  if (value == null) return 'No data yet';
  const unit = kpis[unitKey] || '';
  return `${Number(value).toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
}

function getPfHealthBadge(pf) {
  if (pf == null || !Number.isFinite(Number(pf))) return null;
  const n = Number(pf);
  if (n > 0.95) return { label: 'Excellent', variant: 'success' };
  if (n >= 0.9) return { label: 'Good', variant: 'primary' };
  if (n >= 0.8) return { label: 'Warning', variant: 'warning' };
  return { label: 'Poor', variant: 'danger' };
}

export default function EnergyKpiCards({ kpis, onKpiClick, trailingSlot }) {
  if (!kpis) return null;

  const clickable = typeof onKpiClick === 'function';

  return (
    <Row className="g-2 mb-2">
      {KPI_CONFIG.map((cfg) => {
        const Icon = cfg.icon;
        const pfBadge = cfg.showPfBadge ? getPfHealthBadge(kpis[cfg.key]) : null;

        return (
          <Col key={cfg.key} xs={12} sm={6} lg={4} xl={2}>
            <div
              className={`${styles.kpiCard} ${styles[cfg.variant]} ${clickable ? styles.clickable : ''}`}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => onKpiClick(cfg.key) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onKpiClick(cfg.key);
                      }
                    }
                  : undefined
              }
            >
              <OverlayTrigger
                placement="bottom"
                overlay={<Tooltip id={`energy-kpi-tip-${cfg.key}`}>{cfg.tooltip}</Tooltip>}
              >
                <span
                  className={styles.kpiHelp}
                  aria-label={`About ${cfg.label}`}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <HelpCircle size={15} />
                </span>
              </OverlayTrigger>
              {pfBadge && kpis[cfg.key] != null && (
                <Badge
                  bg={pfBadge.variant}
                  className={styles.pfBadge}
                  title={`PF health: ${pfBadge.label}`}
                >
                  {pfBadge.label}
                </Badge>
              )}
              <div className={styles.kpiIcon}>
                <Icon size={18} />
              </div>
              <div className={styles.kpiLabel}>{cfg.label}</div>
              <div className={styles.kpiValue}>
                <span className={styles.kpiText}>
                  {formatKpiText(kpis, cfg)}
                </span>
              </div>
              {clickable && <div className={styles.hint}>Tap for fleet details</div>}
            </div>
          </Col>
        );
      })}
      {trailingSlot}
    </Row>
  );
}
