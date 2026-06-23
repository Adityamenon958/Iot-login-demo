const ELECTRICAL_HEALTH_METRICS = [
  {
    key: 'voltage',
    label: 'Voltage',
    unit: 'V',
    decimals: 1,
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
  },
  {
    key: 'current',
    label: 'Current',
    unit: 'A',
    decimals: 2,
    rowGroup: 1,
    cardDisplayMode: 'range',
    thresholds: null,
    statusRules: 'none',
    referenceLines: [],
    statsColumns: ['current', 'min', 'max', 'average', 'status'],
    showVariation: false,
  },
  {
    key: 'powerFactor',
    label: 'Power Factor',
    unit: '',
    decimals: 2,
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
  },
  {
    key: 'frequency',
    label: 'Frequency',
    unit: 'Hz',
    decimals: 2,
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
  },
  {
    key: 'activePower',
    label: 'Active Power',
    unit: 'kW',
    decimals: 2,
    rowGroup: 2,
    cardDisplayMode: 'highestLoad',
    thresholds: null,
    statusRules: 'none',
    referenceLines: [],
    statsColumns: ['currentPower', 'peakPower', 'averagePower', 'energyInRange', 'loadFactor', 'status'],
    statsLabels: {
      currentPower: 'Current Power',
      peakPower: 'Peak Power',
      averagePower: 'Average Power',
      energyInRange: 'Energy Used',
      loadFactor: 'Load Factor',
    },
    showVariation: false,
  },
];

const ALLOWED_METRIC_KEYS = ELECTRICAL_HEALTH_METRICS.map((m) => m.key);

const DOWNSAMPLE_MAX_POINTS = {
  '15m': 300,
  '1h': 300,
  '24h': 200,
  '7d': 300,
  '30d': 300,
};

const SPARKLINE_MAX_POINTS = 24;
const MINI_CHART_METER_LIMIT = 5;

function getMetricDefinition(metricKey) {
  return ELECTRICAL_HEALTH_METRICS.find((m) => m.key === metricKey) || null;
}

function evaluateMeterStatus(metricDef, value) {
  if (!metricDef || metricDef.statusRules === 'none') return 'unknown';
  if (value == null || !Number.isFinite(Number(value))) return 'unknown';

  const n = Number(value);
  const { thresholds, statusRules } = metricDef;
  if (!thresholds) return 'unknown';

  if (statusRules === 'range') {
    if (n < thresholds.lower || n > thresholds.upper) {
      const criticalLow = thresholds.lower * 0.95;
      const criticalHigh = thresholds.upper * 1.02;
      if (n < criticalLow || n > criticalHigh) return 'critical';
      return 'warning';
    }
    return 'healthy';
  }

  if (statusRules === 'below') {
    if (n < thresholds.critical) return 'critical';
    if (n < thresholds.warning) return 'warning';
    return 'healthy';
  }

  return 'unknown';
}

function worstStatus(a, b) {
  const rank = { critical: 3, warning: 2, healthy: 1, unknown: 0 };
  return (rank[a] || 0) >= (rank[b] || 0) ? a : b;
}

module.exports = {
  ELECTRICAL_HEALTH_METRICS,
  ALLOWED_METRIC_KEYS,
  DOWNSAMPLE_MAX_POINTS,
  SPARKLINE_MAX_POINTS,
  MINI_CHART_METER_LIMIT,
  getMetricDefinition,
  evaluateMeterStatus,
  worstStatus,
};
