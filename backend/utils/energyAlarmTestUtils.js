const EnergyMeterAlarmRule = require('../models/EnergyMeterAlarmRule');
const Device = require('../models/Device');
const {
  getMetricConfig,
  formatConditionLabel,
  ALARM_METRICS,
} = require('./energyAlarmConfig');

const BREACH_DELTAS = {
  standard: {
    voltage: 3,
    current: 2,
    activePower: 1,
    powerFactor: 0.02,
    frequency: 0.2,
  },
  aggressive: {
    voltage: 10,
    current: 5,
    activePower: 3,
    powerFactor: 0.15,
    frequency: 1,
  },
};

const METRIC_ORDER = ['voltage', 'current', 'activePower', 'powerFactor', 'frequency'];

function round(value, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function computeBreachValue(rule, boundType, breachMode = 'standard') {
  const threshold = boundType === 'min' ? rule.minThreshold : rule.maxThreshold;
  if (threshold == null || !Number.isFinite(Number(threshold))) return null;
  const delta = BREACH_DELTAS[breachMode]?.[rule.metric] ?? 1;
  const t = Number(threshold);
  return boundType === 'max' ? round(t + delta, 2) : round(t - delta, 2);
}

function getBoundDisplayName(metric, boundType) {
  const cfg = getMetricConfig(metric);
  const label = cfg?.label || metric;
  if (metric === 'powerFactor' && boundType === 'min') return 'Low PF';
  if (boundType === 'max') return `High ${label}`;
  return `Low ${label}`;
}

function expandRuleToBounds(rule) {
  const bounds = [];
  if (rule.minThreshold != null && Number.isFinite(Number(rule.minThreshold))) {
    bounds.push({ rule, boundType: 'min' });
  }
  if (rule.maxThreshold != null && Number.isFinite(Number(rule.maxThreshold))) {
    bounds.push({ rule, boundType: 'max' });
  }
  return bounds;
}

function buildBoundKey(ruleId, boundType) {
  return `${ruleId}:${boundType}`;
}

function parseBoundKey(key) {
  const [ruleId, boundType] = key.split(':');
  return { ruleId, boundType };
}

function resolveRuleSelections(allRules, selection = {}) {
  const instantRules = allRules.filter((r) => r.metric !== 'energyConsumption' && r.enabled !== false);
  const allBounds = [];
  instantRules.forEach((rule) => {
    expandRuleToBounds(rule).forEach((b) => allBounds.push(b));
  });

  if (selection.selectAll) {
    return allBounds;
  }

  if (selection.severity === 'warning' || selection.severity === 'critical') {
    return allBounds.filter(({ rule }) => rule.severity === selection.severity);
  }

  const picks = selection.selections || [];
  if (!picks.length) return [];

  const ruleMap = new Map(instantRules.map((r) => [String(r._id), r]));
  const resolved = [];
  picks.forEach(({ ruleId, boundType }) => {
    const rule = ruleMap.get(String(ruleId));
    if (!rule) return;
    if (boundType === 'min' && rule.minThreshold != null) resolved.push({ rule, boundType: 'min' });
    if (boundType === 'max' && rule.maxThreshold != null) resolved.push({ rule, boundType: 'max' });
  });
  return resolved;
}

function computeBreachReadingsForBounds(bounds, breachMode = 'standard') {
  const readings = {};
  const conflicts = [];

  bounds.forEach(({ rule, boundType }) => {
    if (rule.metric === 'energyConsumption') return;
    const value = computeBreachValue(rule, boundType, breachMode);
    if (value == null) return;

    const metric = rule.metric;
    if (readings[metric] != null) {
      const existing = readings[metric];
      const existingIsMax = existing > (boundType === 'max' ? rule.maxThreshold : rule.minThreshold);
      conflicts.push({ metric, existing, incoming: value });
      if (boundType === 'max') {
        readings[metric] = Math.max(existing, value);
      } else {
        readings[metric] = Math.min(existing, value);
      }
    } else {
      readings[metric] = value;
    }
  });

  return { readings, conflicts };
}

function buildExpectedResult(rule, boundType) {
  const delay = rule.triggerDelayMinutes || 0;
  if (delay > 0) {
    return `Will NOT fire on first ingest; requires ${delay} min continuous violation`;
  }
  return 'Active alarm should trigger on next ingest';
}

function buildExpectedOutcomes(bounds, breachMode = 'standard') {
  return bounds.map(({ rule, boundType }) => {
    const threshold = boundType === 'min' ? rule.minThreshold : rule.maxThreshold;
    const generatedBreachValue = computeBreachValue(rule, boundType, breachMode);
    return {
      ruleId: String(rule._id),
      boundType,
      metric: rule.metric,
      displayName: getBoundDisplayName(rule.metric, boundType),
      conditionLabel: formatConditionLabel(rule.metric, boundType, threshold),
      threshold,
      generatedBreachValue,
      severity: rule.severity,
      triggerDelayMinutes: rule.triggerDelayMinutes || 0,
      expectedResult: buildExpectedResult(rule, boundType),
    };
  });
}

function groupRulesByMetric(ruleBounds) {
  const groups = new Map();

  ruleBounds.forEach(({ rule, boundType }) => {
    if (!groups.has(rule.metric)) {
      const cfg = getMetricConfig(rule.metric);
      groups.set(rule.metric, {
        metric: rule.metric,
        label: cfg?.label || rule.metric,
        unit: cfg?.unit || '',
        rules: [],
      });
    }
    const threshold = boundType === 'min' ? rule.minThreshold : rule.maxThreshold;
    groups.get(rule.metric).rules.push({
      ruleId: String(rule._id),
      metric: rule.metric,
      boundType,
      displayName: getBoundDisplayName(rule.metric, boundType),
      conditionLabel: formatConditionLabel(rule.metric, boundType, threshold),
      threshold,
      severity: rule.severity,
      triggerDelayMinutes: rule.triggerDelayMinutes || 0,
      breachValues: {
        standard: computeBreachValue(rule, boundType, 'standard'),
        aggressive: computeBreachValue(rule, boundType, 'aggressive'),
      },
      selectionKey: buildBoundKey(rule._id, boundType),
    });
  });

  return METRIC_ORDER
    .filter((m) => groups.has(m))
    .map((m) => groups.get(m))
    .concat(
      [...groups.keys()]
        .filter((m) => !METRIC_ORDER.includes(m))
        .map((m) => groups.get(m))
    );
}

async function loadEnabledRulesForMeter(meterId) {
  const device = await Device.findOne({ deviceId: meterId, deviceType: 'energyMeter' }).lean();
  if (!device) {
    const err = new Error(`Energy meter "${meterId}" is not registered in Manage Devices`);
    err.statusCode = 404;
    throw err;
  }

  const rules = await EnergyMeterAlarmRule.find({
    meterId,
    companyName: device.companyName,
    enabled: true,
  }).lean();

  return { device, rules };
}

function buildAlarmTestPlan(rules) {
  const instantRules = rules.filter((r) => r.metric !== 'energyConsumption');
  const consumptionRules = rules.filter((r) => r.metric === 'energyConsumption');

  const instantBounds = [];
  instantRules.forEach((rule) => {
    expandRuleToBounds(rule).forEach((b) => instantBounds.push(b));
  });

  const rulesByMetric = groupRulesByMetric(instantBounds);

  const counts = {
    warning: instantBounds.filter(({ rule }) => rule.severity === 'warning').length,
    critical: instantBounds.filter(({ rule }) => rule.severity === 'critical').length,
    total: instantBounds.length,
  };

  const { readings: triggerAllStandard } = computeBreachReadingsForBounds(instantBounds, 'standard');
  const { readings: triggerAllAggressive } = computeBreachReadingsForBounds(instantBounds, 'aggressive');

  return {
    defaultBreachMode: 'standard',
    rulesByMetric,
    consumptionRules: consumptionRules.map((rule) => ({
      ruleId: String(rule._id),
      consumptionPeriod: rule.consumptionPeriod || 'today',
      threshold: rule.maxThreshold ?? rule.minThreshold,
      boundType: rule.maxThreshold != null ? 'max' : 'min',
      severity: rule.severity,
      conditionLabel: formatConditionLabel(
        rule.metric,
        rule.maxThreshold != null ? 'max' : 'min',
        rule.maxThreshold ?? rule.minThreshold
      ),
      expectedResult: 'Requires consumption burst sequence',
    })),
    counts,
    triggerAllPreview: {
      standard: { readings: triggerAllStandard, ruleCount: instantBounds.length },
      aggressive: { readings: triggerAllAggressive, ruleCount: instantBounds.length },
    },
  };
}

/**
 * Plan a multi-step consumption burst to breach an energyConsumption rule.
 */
function planConsumptionBurst(rule, device, options = {}) {
  const steps = options.steps || 4;
  const breachMode = options.breachMode || 'standard';
  const margin = breachMode === 'aggressive' ? 5 : 1;
  const threshold = rule.maxThreshold ?? rule.minThreshold;
  if (threshold == null) {
    return { steps: [], totalDeltaKwh: 0, expectedConsumption: 0 };
  }

  const baseEnergy = device.energyBaseReading != null ? Number(device.energyBaseReading) : 0;
  const targetConsumption = Number(threshold) + margin;
  const deltaPerStep = round(targetConsumption / steps, 2);
  const plannedSteps = [];

  for (let i = 1; i <= steps; i += 1) {
    const cumulativeDelta = round(deltaPerStep * i, 2);
    plannedSteps.push({
      step: i,
      energyKwh: round(baseEnergy + cumulativeDelta, 2),
      cumulativeConsumptionKwh: cumulativeDelta,
      label: i === steps ? 'Final breach step' : `Ramp step ${i}`,
    });
  }

  return {
    steps: plannedSteps,
    totalDeltaKwh: round(deltaPerStep * steps, 2),
    expectedConsumption: round(deltaPerStep * steps, 2),
    threshold,
    breachMode,
    period: rule.consumptionPeriod || 'today',
  };
}

function formatReadingsSummary(readings) {
  if (!readings) return '';
  const parts = [];
  if (readings.voltage != null) parts.push(`${readings.voltage}V`);
  if (readings.current != null) parts.push(`${readings.current}A`);
  if (readings.activePower != null) parts.push(`${readings.activePower}kW`);
  if (readings.powerFactor != null) parts.push(`PF ${readings.powerFactor}`);
  if (readings.frequency != null) parts.push(`${readings.frequency}Hz`);
  return parts.join(', ');
}

module.exports = {
  BREACH_DELTAS,
  BREACH_MODES: ['standard', 'aggressive'],
  computeBreachValue,
  getBoundDisplayName,
  expandRuleToBounds,
  buildBoundKey,
  parseBoundKey,
  resolveRuleSelections,
  computeBreachReadingsForBounds,
  buildExpectedOutcomes,
  groupRulesByMetric,
  loadEnabledRulesForMeter,
  buildAlarmTestPlan,
  planConsumptionBurst,
  formatReadingsSummary,
};
