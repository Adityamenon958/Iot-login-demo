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
    tooltip:
      'Total instantaneous power (kW) across all online meters right now. Offline meters are not included in this sum.',
  },
  {
    key: 'todayEnergyConsumption',
    label: "Today's Consumption",
    icon: BatteryCharging,
    variant: 'energy',
    unitKey: 'todayEnergyUnit',
    decimals: 2,
    tooltip:
      "Total energy used today (IST) across all visible meters. For each meter, today's consumption is the change in cumulative kWh since midnight—not the sum of raw meter readings.",
  },
  {
    key: 'averagePowerFactor',
    label: 'Avg Power Factor',
    icon: Gauge,
    variant: 'pf',
    decimals: 2,
    showPfBadge: true,
    tooltip:
      'Average of the latest power factor readings across visible meters. Higher PF means more efficient use of supplied power.',
  },
  {
    key: 'averageVoltage',
    label: 'Avg Voltage',
    icon: Activity,
    variant: 'voltage',
    unitKey: 'averageVoltageUnit',
    decimals: 1,
    tooltip:
      'Average of the latest voltage (V) readings across visible meters with valid data.',
  },
  {
    key: 'averageFrequency',
    label: 'Avg Frequency',
    icon: Radio,
    variant: 'frequency',
    unitKey: 'averageFrequencyUnit',
    decimals: 2,
    tooltip:
      'Average of the latest grid frequency (Hz) readings across visible meters with valid data.',
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

export default function EnergyKpiCards({ kpis }) {
  if (!kpis) return null;

  return (
    <Row className="g-2 mb-2">
      {KPI_CONFIG.map((cfg) => {
        const Icon = cfg.icon;
        const pfBadge = cfg.showPfBadge ? getPfHealthBadge(kpis[cfg.key]) : null;

        return (
          <Col key={cfg.key} xs={12} sm={6} lg={4} xl={2}>
            <div className={`${styles.kpiCard} ${styles[cfg.variant]}`}>
              <OverlayTrigger
                placement="bottom"
                overlay={<Tooltip id={`energy-kpi-tip-${cfg.key}`}>{cfg.tooltip}</Tooltip>}
              >
                <span className={styles.kpiHelp} aria-label={`About ${cfg.label}`}>
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
            </div>
          </Col>
        );
      })}
    </Row>
  );
}
