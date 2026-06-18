import {
  Activity,
  Gauge,
  Radio,
  Zap,
} from 'lucide-react';

export const ELECTRICAL_HEALTH_METRICS = [
  {
    key: 'voltage',
    label: 'Voltage',
    unit: 'V',
    decimals: 1,
    icon: Activity,
    rowGroup: 1,
    cardDisplayMode: 'range',
    thresholds: { lower: 220, upper: 240 },
    statusRules: 'range',
    referenceLines: [
      { value: 220, label: '220V min', stroke: '#fd7e14' },
      { value: 240, label: '240V max', stroke: '#fd7e14' },
    ],
    statsColumns: ['current', 'min', 'max', 'average', 'variation', 'status'],
    showVariation: true,
    cardAlertLabel: 'outside range',
    tooltip: 'Latest voltage range across meters. Click for per-meter chart.',
  },
  {
    key: 'current',
    label: 'Current',
    unit: 'A',
    decimals: 2,
    icon: Zap,
    rowGroup: 1,
    cardDisplayMode: 'range',
    thresholds: null,
    statusRules: 'none',
    referenceLines: [],
    statsColumns: ['current', 'min', 'max', 'average', 'status'],
    showVariation: false,
    tooltip: 'Latest current range across meters. Click for per-meter chart.',
  },
  {
    key: 'powerFactor',
    label: 'Power Factor',
    unit: '',
    decimals: 2,
    icon: Gauge,
    rowGroup: 1,
    cardDisplayMode: 'range',
    thresholds: { warning: 0.9, critical: 0.8 },
    statusRules: 'below',
    referenceLines: [
      { value: 0.9, label: '0.90 warn', stroke: '#fd7e14' },
      { value: 0.8, label: '0.80 crit', stroke: '#dc3545' },
    ],
    statsColumns: ['current', 'min', 'max', 'average', 'variation', 'status'],
    showVariation: true,
    cardAlertLabel: 'below threshold',
    tooltip: 'Latest PF range across meters. Warns below 0.90.',
  },
  {
    key: 'frequency',
    label: 'Frequency',
    unit: 'Hz',
    decimals: 2,
    icon: Radio,
    rowGroup: 2,
    cardDisplayMode: 'range',
    thresholds: { lower: 49.5, upper: 50.5 },
    statusRules: 'range',
    referenceLines: [
      { value: 49.5, label: '49.5Hz min', stroke: '#fd7e14' },
      { value: 50.5, label: '50.5Hz max', stroke: '#fd7e14' },
    ],
    statsColumns: ['current', 'min', 'max', 'average', 'variation', 'status'],
    showVariation: true,
    cardAlertLabel: 'outside range',
    tooltip: 'Latest frequency range across meters. Healthy: 49.5–50.5 Hz.',
  },
  {
    key: 'activePower',
    label: 'Active Power',
    unit: 'kW',
    decimals: 2,
    icon: Zap,
    rowGroup: 2,
    cardDisplayMode: 'highestLoad',
    thresholds: null,
    statusRules: 'none',
    referenceLines: [],
    statsColumns: ['currentPower', 'peakPower', 'averagePower', 'energyInRange', 'loadFactor', 'status'],
    statsLabels: {
      currentPower: 'Current',
      peakPower: 'Peak',
      averagePower: 'Average',
      energyInRange: 'Energy',
      loadFactor: 'Load Factor',
    },
    showVariation: false,
    tooltip: 'Meter drawing the most kW right now. Click for all meters.',
  },
];

export const HEALTH_COLORS = {
  healthy: { border: '#198754', badge: 'success', text: '#198754' },
  warning: { border: '#fd7e14', badge: 'warning', text: '#fd7e14' },
  critical: { border: '#dc3545', badge: 'danger', text: '#dc3545' },
  unknown: { border: '#6c757d', badge: 'secondary', text: '#6c757d' },
};

export function getMetricDefinition(metricKey) {
  return ELECTRICAL_HEALTH_METRICS.find((m) => m.key === metricKey) || null;
}

export function getMetricsByRow(rowGroup) {
  return ELECTRICAL_HEALTH_METRICS.filter((m) => m.rowGroup === rowGroup);
}
