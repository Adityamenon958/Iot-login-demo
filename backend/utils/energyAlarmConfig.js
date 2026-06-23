const ALARM_METRICS = {
  voltage: { label: 'Voltage', unit: 'V', defaultHysteresis: 2 },
  current: { label: 'Current', unit: 'A', defaultHysteresis: 0.5 },
  activePower: { label: 'Active Power', unit: 'kW', defaultHysteresis: 0.1 },
  powerFactor: { label: 'Power Factor', unit: '', defaultHysteresis: 0.02 },
  frequency: { label: 'Frequency', unit: 'Hz', defaultHysteresis: 0.1 },
  energyConsumption: {
    label: 'Energy Consumption',
    unit: 'kWh',
    defaultHysteresis: 0.5,
    needsPeriod: true,
  },
};

const CONSUMPTION_PERIODS = [
  { key: 'today', label: 'Today (IST)' },
  { key: '24h', label: 'Last 24 hours' },
  { key: '7d', label: 'Last 7 days' },
];

const SEVERITY_ORDER = { critical: 2, warning: 1 };

const OPEN_STATUSES = ['active', 'acknowledged'];

function getMetricConfig(metric) {
  return ALARM_METRICS[metric] || null;
}

function getDefaultHysteresis(metric, ruleHysteresis) {
  if (ruleHysteresis != null && Number.isFinite(ruleHysteresis)) return ruleHysteresis;
  return ALARM_METRICS[metric]?.defaultHysteresis ?? 0;
}

function formatConditionLabel(metric, boundType, threshold) {
  const cfg = getMetricConfig(metric);
  const label = cfg?.label || metric;
  const unit = cfg?.unit ? ` ${cfg.unit}` : '';
  const op = boundType === 'min' ? '< min' : '> max';
  return `${label} ${op} (${threshold}${unit})`;
}

function formatAlarmMessage(metric, boundType, threshold, actualValue) {
  const cfg = getMetricConfig(metric);
  const label = cfg?.label || metric;
  const unit = cfg?.unit || '';
  const unitStr = unit ? ` ${unit}` : '';
  if (boundType === 'min') {
    return `${label} ${actualValue}${unitStr} below min ${threshold}${unitStr}`;
  }
  return `${label} ${actualValue}${unitStr} exceeded max ${threshold}${unitStr}`;
}

function highestSeverity(events) {
  if (!events?.length) return null;
  let best = null;
  let bestScore = 0;
  events.forEach((e) => {
    const score = SEVERITY_ORDER[e.severity] || 0;
    if (score > bestScore) {
      bestScore = score;
      best = e.severity;
    }
  });
  return best;
}

function compareSeverity(a, b) {
  return (SEVERITY_ORDER[b] || 0) - (SEVERITY_ORDER[a] || 0);
}

function validateRulePayload(body) {
  const errors = [];
  const { metric, minThreshold, maxThreshold, consumptionPeriod } = body;

  if (!metric || !ALARM_METRICS[metric]) {
    errors.push('Invalid metric');
  }

  const hasMin = minThreshold != null && minThreshold !== '' && Number.isFinite(Number(minThreshold));
  const hasMax = maxThreshold != null && maxThreshold !== '' && Number.isFinite(Number(maxThreshold));

  if (!hasMin && !hasMax) {
    errors.push('At least one of minThreshold or maxThreshold is required');
  }
  if (hasMin && hasMax && Number(minThreshold) >= Number(maxThreshold)) {
    errors.push('minThreshold must be less than maxThreshold');
  }
  if (metric === 'energyConsumption' && !consumptionPeriod) {
    errors.push('consumptionPeriod is required for energy consumption alarms');
  }

  return errors;
}

module.exports = {
  ALARM_METRICS,
  CONSUMPTION_PERIODS,
  SEVERITY_ORDER,
  OPEN_STATUSES,
  getMetricConfig,
  getDefaultHysteresis,
  formatConditionLabel,
  formatAlarmMessage,
  highestSeverity,
  compareSeverity,
  validateRulePayload,
};
