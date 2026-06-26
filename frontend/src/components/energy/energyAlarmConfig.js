export const ALARM_METRICS = {
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

export const CONSUMPTION_PERIODS = [
  { key: 'today', label: 'Today (IST)' },
  { key: '24h', label: 'Last 24 hours' },
  { key: '7d', label: 'Last 7 days' },
];

export const SEVERITY_OPTIONS = [
  { key: 'warning', label: 'Warning' },
  { key: 'critical', label: 'Critical' },
];

export const SEVERITY_ORDER = { critical: 2, warning: 1 };

export function getMetricLabel(metric) {
  return ALARM_METRICS[metric]?.label || metric;
}

export function getMetricUnit(metric) {
  return ALARM_METRICS[metric]?.unit || '';
}

export function formatValueWithUnit(value, metric) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const unit = getMetricUnit(metric);
  return `${Number(value)}${unit ? ` ${unit}` : ''}`;
}

export function formatConditionLabel(metric, boundType, threshold) {
  const label = getMetricLabel(metric);
  const unit = getMetricUnit(metric);
  const unitStr = unit ? ` ${unit}` : '';
  const op = boundType === 'min' ? '< min' : '> max';
  return `${label} ${op} (${threshold}${unitStr})`;
}

export function highestSeverity(events) {
  if (!events?.length) return null;
  let best = null;
  let bestScore = 0;
  events.forEach((e) => {
    const sev = e.highestSeverity || e.severity;
    const score = SEVERITY_ORDER[sev] || 0;
    if (score > bestScore) {
      bestScore = score;
      best = sev;
    }
  });
  return best;
}

export function validateRuleForm(form) {
  const errors = [];
  const hasMin = form.minThreshold !== '' && form.minThreshold != null && Number.isFinite(Number(form.minThreshold));
  const hasMax = form.maxThreshold !== '' && form.maxThreshold != null && Number.isFinite(Number(form.maxThreshold));

  if (!hasMin && !hasMax) errors.push('Set at least a min or max threshold.');
  if (hasMin && hasMax && Number(form.minThreshold) >= Number(form.maxThreshold)) {
    errors.push('Min must be less than max.');
  }
  if (form.metric === 'energyConsumption' && !form.consumptionPeriod) {
    errors.push('Select a consumption period for energy alarms.');
  }
  return errors;
}

export const EMPTY_RULE_FORM = {
  metric: 'voltage',
  minThreshold: '',
  maxThreshold: '',
  consumptionPeriod: 'today',
  severity: 'warning',
  cooldownMinutes: 5,
  enabled: true,
  label: '',
};

export function ruleToForm(rule) {
  if (!rule) return { ...EMPTY_RULE_FORM };
  return {
    metric: rule.metric || 'voltage',
    minThreshold: rule.minThreshold != null ? String(rule.minThreshold) : '',
    maxThreshold: rule.maxThreshold != null ? String(rule.maxThreshold) : '',
    consumptionPeriod: rule.consumptionPeriod || 'today',
    severity: rule.severity || 'warning',
    cooldownMinutes: rule.cooldownMinutes ?? 5,
    enabled: rule.enabled !== false,
    label: rule.label || '',
  };
}

export function formToPayload(form) {
  const payload = {
    metric: form.metric,
    severity: form.severity,
    cooldownMinutes: Number(form.cooldownMinutes) || 5,
    enabled: form.enabled !== false,
    label: form.label || '',
    minThreshold: form.minThreshold !== '' ? Number(form.minThreshold) : null,
    maxThreshold: form.maxThreshold !== '' ? Number(form.maxThreshold) : null,
  };
  if (form.metric === 'energyConsumption') {
    payload.consumptionPeriod = form.consumptionPeriod;
  }
  return payload;
}

/** Map alarm metric keys to parameter tile keys on the meter detail page. */
export function alarmMetricToParameterKey(metric) {
  if (metric === 'energyConsumption') return 'energy';
  return metric;
}

export function mapAlarmMetricsToParameterKeys(metrics = []) {
  const keys = new Set();
  metrics.forEach((m) => {
    const key = alarmMetricToParameterKey(m);
    if (key) keys.add(key);
  });
  return Array.from(keys);
}

export function formatRelativeTime(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
}

export const PULSE_ATTENTION_MS = 8000;
export const ALARM_SOUND_STORAGE_KEY = 'energyAlarmSoundEnabled';
export const ENERGY_PAGE_TITLE_BASE = 'Energy Dashboard';
export const SEEN_ALARM_EVENTS_KEY = 'energyAlarmSeenEventIds';
