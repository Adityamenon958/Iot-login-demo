const EnergyMeterLog = require('../models/EnergyMeterLog');
const EnergyMeterAlarmRule = require('../models/EnergyMeterAlarmRule');
const EnergyMeterAlarmEvent = require('../models/EnergyMeterAlarmEvent');
const EnergyMeterAlarmRuleState = require('../models/EnergyMeterAlarmRuleState');
const Device = require('../models/Device');
const { buildReadings, pickReadingValue } = require('./energyMeterUtils');
const {
  getDefaultHysteresis,
  formatConditionLabel,
  formatAlarmMessage,
  highestSeverity,
  compareSeverity,
  OPEN_STATUSES,
  validateRulePayload,
  ALARM_METRICS,
  CONSUMPTION_PERIODS,
} = require('./energyAlarmConfig');
const {
  bucketLogsByIstDate,
  sumDailyKwhInRange,
  getTodayStartIstUtc,
} = require('./meterInsightsUtils');

function formatMeterDisplayName(meterId, machineName) {
  if (machineName) return `${meterId} (${machineName})`;
  return meterId;
}

function extractEnergy(log) {
  let readings = log.readings;
  if (!readings || !Object.keys(readings).length) {
    readings = buildReadings(log.rawValues || [], []);
  }
  return pickReadingValue(readings, 'energy');
}

function getPeriodStart(period, now = new Date()) {
  if (period === 'today') return getTodayStartIstUtc(now);
  if (period === '24h') return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (period === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return getTodayStartIstUtc(now);
}

async function computeConsumptionValue(meterId, period, cache) {
  const cacheKey = `${meterId}:${period}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const now = new Date();
  const since = getPeriodStart(period, now);
  const logs = await EnergyMeterLog.find({
    meterId,
    timestamp: { $gte: since },
  })
    .sort({ timestamp: 1 })
    .lean();

  let value = null;
  if (period === 'today') {
    const todayStart = getTodayStartIstUtc(now);
    const todayLogs = logs.filter((l) => new Date(l.timestamp) >= todayStart);
    const energies = todayLogs.map(extractEnergy).filter((e) => e != null);
    if (energies.length >= 2) {
      value = Math.max(0, energies[energies.length - 1] - energies[0]);
    } else if (energies.length === 1) {
      value = 0;
    }
  } else {
    const daily = bucketLogsByIstDate(logs, extractEnergy);
    value = sumDailyKwhInRange(daily, since, now);
  }

  cache.set(cacheKey, value);
  return value;
}

async function resolveMetricValue(log, rule, consumptionCache) {
  if (rule.metric === 'energyConsumption') {
    return computeConsumptionValue(log.meterId, rule.consumptionPeriod || 'today', consumptionCache);
  }
  const readings = log.readings || {};
  return pickReadingValue(readings, rule.metric);
}

function isBreachingMin(value, minThreshold) {
  return minThreshold != null && value != null && value < minThreshold;
}

function isBreachingMax(value, maxThreshold) {
  return maxThreshold != null && value != null && value > maxThreshold;
}

function isClearedMin(value, minThreshold, hysteresis) {
  if (minThreshold == null || value == null) return true;
  return value >= minThreshold + hysteresis;
}

function isClearedMax(value, maxThreshold, hysteresis) {
  if (maxThreshold == null || value == null) return true;
  return value <= maxThreshold - hysteresis;
}

function isCooldownActive(state, cooldownMinutes, now) {
  if (!state?.lastTriggeredAt || !cooldownMinutes) return false;
  const elapsed = now.getTime() - new Date(state.lastTriggeredAt).getTime();
  return elapsed < cooldownMinutes * 60 * 1000;
}

function durationMet(state, triggerDelayMinutes, now) {
  if (!triggerDelayMinutes || triggerDelayMinutes <= 0) return true;
  if (!state?.violationStartedAt) return false;
  const elapsed = now.getTime() - new Date(state.violationStartedAt).getTime();
  return elapsed >= triggerDelayMinutes * 60 * 1000;
}

async function getOrCreateState(ruleId, boundType) {
  let state = await EnergyMeterAlarmRuleState.findOne({ ruleId, boundType });
  if (!state) {
    state = await EnergyMeterAlarmRuleState.create({ ruleId, boundType });
  }
  return state;
}

async function evaluateBound({
  rule,
  boundType,
  threshold,
  log,
  meterName,
  value,
  now,
  state,
}) {
  if (threshold == null || value == null || !Number.isFinite(value)) {
    state.inViolation = false;
    state.violationStartedAt = null;
    state.lastEvaluatedAt = now;
    state.lastValue = value;
    await state.save();
    return;
  }

  const hysteresis = getDefaultHysteresis(rule.metric, rule.hysteresis);
  const breaching =
    boundType === 'min' ? isBreachingMin(value, threshold) : isBreachingMax(value, threshold);
  const cleared =
    boundType === 'min'
      ? isClearedMin(value, threshold, hysteresis)
      : isClearedMax(value, threshold, hysteresis);

  let openEvent = null;
  if (state.lastEventId) {
    openEvent = await EnergyMeterAlarmEvent.findById(state.lastEventId);
    if (openEvent && openEvent.status === 'cleared') {
      openEvent = null;
      state.lastEventId = null;
    }
  }

  if (breaching) {
    if (!state.inViolation) {
      state.inViolation = true;
      state.violationStartedAt = now;
    }

    if (openEvent && OPEN_STATUSES.includes(openEvent.status)) {
      openEvent.actualValue = value;
      await openEvent.save();
    } else if (!openEvent && durationMet(state, rule.triggerDelayMinutes, now)) {
      if (isCooldownActive(state, rule.cooldownMinutes, now)) {
        // skip new event during cooldown
      } else {
        const conditionLabel = formatConditionLabel(rule.metric, boundType, threshold);
        const message = formatAlarmMessage(rule.metric, boundType, threshold, value);
        const event = await EnergyMeterAlarmEvent.create({
          ruleId: rule._id,
          companyName: rule.companyName,
          meterId: rule.meterId,
          meterName,
          metric: rule.metric,
          boundType,
          conditionLabel,
          threshold,
          actualValue: value,
          consumptionPeriod: rule.metric === 'energyConsumption' ? rule.consumptionPeriod : null,
          severity: rule.severity,
          message,
          status: 'active',
          triggeredAt: now,
          triggerLogId: log._id,
          notificationStatus: 'pending',
          pendingChannels: ['email'],
        });
        state.lastEventId = event._id;
        state.lastTriggeredAt = now;
      }
    }
  } else if (cleared) {
    state.inViolation = false;
    state.violationStartedAt = null;

    if (openEvent && OPEN_STATUSES.includes(openEvent.status)) {
      openEvent.status = 'cleared';
      openEvent.clearedAt = now;
      await openEvent.save();
      state.lastEventId = null;
    }
  }

  state.lastEvaluatedAt = now;
  state.lastValue = value;
  await state.save();
}

async function evaluateRuleForLog(rule, log, meterName, consumptionCache) {
  const value = await resolveMetricValue(log, rule, consumptionCache);
  const now = new Date(log.timestamp || log.receivedAt || Date.now());

  if (rule.minThreshold != null) {
    const state = await getOrCreateState(rule._id, 'min');
    await evaluateBound({
      rule,
      boundType: 'min',
      threshold: rule.minThreshold,
      log,
      meterName,
      value,
      now,
      state,
    });
  }

  if (rule.maxThreshold != null) {
    const state = await getOrCreateState(rule._id, 'max');
    await evaluateBound({
      rule,
      boundType: 'max',
      threshold: rule.maxThreshold,
      log,
      meterName,
      value,
      now,
      state,
    });
  }
}

async function evaluateEnergyMeterAlarms(savedLogs) {
  if (!savedLogs?.length) return;

  const byMeter = new Map();
  savedLogs.forEach((log) => {
    const id = log.meterId;
    if (!id) return;
    if (!byMeter.has(id)) byMeter.set(id, []);
    byMeter.get(id).push(log);
  });

  const consumptionCache = new Map();

  for (const [meterId, logs] of byMeter.entries()) {
    const latestLog = logs[logs.length - 1];
    const companyName = latestLog.companyName;
    if (!companyName) continue;

    const rules = await EnergyMeterAlarmRule.find({
      meterId,
      companyName,
      enabled: true,
    }).lean();

    if (!rules.length) continue;

    const device = await Device.findOne({ deviceId: meterId, deviceType: 'energyMeter' }).lean();
    const meterName = formatMeterDisplayName(meterId, device?.machineName || latestLog.machineName);

    for (const rule of rules) {
      await evaluateRuleForLog(rule, latestLog, meterName, consumptionCache);
    }
  }
}

async function assertMeterAccess(meterId, visibleMeterIds) {
  if (!visibleMeterIds.includes(meterId)) {
    const err = new Error('Meter not found or access denied');
    err.statusCode = 403;
    throw err;
  }
}

function serializeEvent(doc) {
  const e = doc.toObject ? doc.toObject() : doc;
  return {
    _id: e._id,
    ruleId: e.ruleId,
    companyName: e.companyName,
    meterId: e.meterId,
    meterName: e.meterName,
    metric: e.metric,
    boundType: e.boundType,
    conditionLabel: e.conditionLabel,
    threshold: e.threshold,
    actualValue: e.actualValue,
    consumptionPeriod: e.consumptionPeriod,
    severity: e.severity,
    status: e.status,
    message: e.message,
    triggeredAt: e.triggeredAt,
    acknowledgedAt: e.acknowledgedAt,
    acknowledgedBy: e.acknowledgedBy,
    acknowledgeComment: e.acknowledgeComment || '',
    clearedAt: e.clearedAt,
    triggerLogId: e.triggerLogId,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

function serializeRule(doc) {
  const r = doc.toObject ? doc.toObject() : doc;
  return {
    _id: r._id,
    companyName: r.companyName,
    meterId: r.meterId,
    metric: r.metric,
    minThreshold: r.minThreshold,
    maxThreshold: r.maxThreshold,
    consumptionPeriod: r.consumptionPeriod,
    severity: r.severity,
    enabled: r.enabled,
    cooldownMinutes: r.cooldownMinutes,
    triggerDelayMinutes: r.triggerDelayMinutes,
    hysteresis: r.hysteresis,
    label: r.label,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

async function listRules(visibleMeters, filters = {}) {
  const meterIds = visibleMeters.map((m) => m.deviceId);
  const query = { meterId: { $in: meterIds } };
  if (filters.meterId) query.meterId = filters.meterId;
  if (filters.metric) query.metric = filters.metric;
  if (filters.severity) query.severity = filters.severity;
  if (filters.enabled !== undefined && filters.enabled !== '') {
    query.enabled = filters.enabled === 'true' || filters.enabled === true;
  }
  return EnergyMeterAlarmRule.find(query).sort({ meterId: 1, metric: 1 }).lean();
}

async function createRule(meterId, companyName, body, userId) {
  const errors = validateRulePayload(body);
  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.statusCode = 400;
    throw err;
  }

  const ruleData = {
    companyName,
    meterId,
    metric: body.metric,
    minThreshold: body.minThreshold != null && body.minThreshold !== '' ? Number(body.minThreshold) : null,
    maxThreshold: body.maxThreshold != null && body.maxThreshold !== '' ? Number(body.maxThreshold) : null,
    severity: body.severity === 'critical' ? 'critical' : 'warning',
    enabled: body.enabled !== false,
    cooldownMinutes: body.cooldownMinutes != null ? Number(body.cooldownMinutes) : 5,
    triggerDelayMinutes: body.triggerDelayMinutes != null ? Number(body.triggerDelayMinutes) : 0,
    hysteresis: body.hysteresis != null && body.hysteresis !== '' ? Number(body.hysteresis) : null,
    label: body.label || '',
    createdBy: userId || '',
  };
  if (body.metric === 'energyConsumption') {
    ruleData.consumptionPeriod = body.consumptionPeriod || 'today';
  }

  const rule = await EnergyMeterAlarmRule.create(ruleData);

  return rule;
}

async function updateRule(ruleId, visibleMeters, body) {
  const meterIds = visibleMeters.map((m) => m.deviceId);
  const rule = await EnergyMeterAlarmRule.findOne({ _id: ruleId, meterId: { $in: meterIds } });
  if (!rule) {
    const err = new Error('Rule not found');
    err.statusCode = 404;
    throw err;
  }

  const errors = validateRulePayload({ ...rule.toObject(), ...body });
  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.statusCode = 400;
    throw err;
  }

  if (body.metric != null) rule.metric = body.metric;
  if (body.minThreshold !== undefined) {
    rule.minThreshold = body.minThreshold != null && body.minThreshold !== '' ? Number(body.minThreshold) : null;
  }
  if (body.maxThreshold !== undefined) {
    rule.maxThreshold = body.maxThreshold != null && body.maxThreshold !== '' ? Number(body.maxThreshold) : null;
  }
  if (body.consumptionPeriod !== undefined) rule.consumptionPeriod = body.consumptionPeriod;
  if (body.metric && body.metric !== 'energyConsumption') rule.consumptionPeriod = null;
  if (body.severity != null) rule.severity = body.severity === 'critical' ? 'critical' : 'warning';
  if (body.enabled !== undefined) rule.enabled = body.enabled !== false;
  if (body.cooldownMinutes != null) rule.cooldownMinutes = Number(body.cooldownMinutes);
  if (body.triggerDelayMinutes != null) rule.triggerDelayMinutes = Number(body.triggerDelayMinutes);
  if (body.hysteresis !== undefined) {
    rule.hysteresis = body.hysteresis != null && body.hysteresis !== '' ? Number(body.hysteresis) : null;
  }
  if (body.label !== undefined) rule.label = body.label || '';

  await rule.save();
  return rule;
}

async function deleteRule(ruleId, visibleMeters) {
  const meterIds = visibleMeters.map((m) => m.deviceId);
  const rule = await EnergyMeterAlarmRule.findOneAndDelete({ _id: ruleId, meterId: { $in: meterIds } });
  if (!rule) {
    const err = new Error('Rule not found');
    err.statusCode = 404;
    throw err;
  }
  await EnergyMeterAlarmRuleState.deleteMany({ ruleId });
  return rule;
}

async function toggleRule(ruleId, visibleMeters, enabled) {
  const meterIds = visibleMeters.map((m) => m.deviceId);
  const rule = await EnergyMeterAlarmRule.findOne({ _id: ruleId, meterId: { $in: meterIds } });
  if (!rule) {
    const err = new Error('Rule not found');
    err.statusCode = 404;
    throw err;
  }
  rule.enabled = enabled;
  await rule.save();
  return rule;
}

function sortEventsBySeverity(events) {
  return [...events].sort((a, b) => {
    const sev = compareSeverity(a.severity, b.severity);
    if (sev !== 0) return sev;
    return new Date(b.triggeredAt) - new Date(a.triggeredAt);
  });
}

async function listEvents(visibleMeters, filters = {}, page = 1, limit = 20) {
  const meterIds = visibleMeters.map((m) => m.deviceId);
  const query = { meterId: { $in: meterIds } };
  if (filters.meterId) query.meterId = filters.meterId;
  if (filters.status) query.status = filters.status;
  if (filters.metric) query.metric = filters.metric;
  if (filters.severity) query.severity = filters.severity;
  if (filters.from || filters.to) {
    query.triggeredAt = {};
    if (filters.from) query.triggeredAt.$gte = new Date(filters.from);
    if (filters.to) query.triggeredAt.$lte = new Date(filters.to);
  }

  const skip = (Math.max(1, page) - 1) * limit;
  const [total, rows] = await Promise.all([
    EnergyMeterAlarmEvent.countDocuments(query),
    EnergyMeterAlarmEvent.find(query).sort({ triggeredAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  return { data: rows.map(serializeEvent), total, page, limit };
}

async function listActiveEvents(visibleMeters, meterId = null) {
  const meterIds = visibleMeters.map((m) => m.deviceId);
  const query = {
    meterId: meterId ? meterId : { $in: meterIds },
    status: { $in: OPEN_STATUSES },
  };
  if (meterId && !meterIds.includes(meterId)) {
    const err = new Error('Meter not found or access denied');
    err.statusCode = 403;
    throw err;
  }

  const rows = await EnergyMeterAlarmEvent.find(query).lean();
  return sortEventsBySeverity(rows.map(serializeEvent));
}

async function buildAlarmSummary(visibleMeters) {
  const meterIds = visibleMeters.map((m) => m.deviceId);
  const todayStart = getTodayStartIstUtc();
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [openEvents, todayTriggeredCount] = await Promise.all([
    EnergyMeterAlarmEvent.find({
      meterId: { $in: meterIds },
      status: { $in: OPEN_STATUSES },
    }).lean(),
    EnergyMeterAlarmEvent.countDocuments({
      meterId: { $in: meterIds },
      triggeredAt: { $gte: todayStart, $lt: tomorrowStart },
    }),
  ]);

  let activeCount = 0;
  let acknowledgedCount = 0;
  let criticalCount = 0;
  let warningCount = 0;
  const byMeter = {};

  openEvents.forEach((e) => {
    if (e.status === 'active') activeCount += 1;
    if (e.status === 'acknowledged') acknowledgedCount += 1;
    if (e.severity === 'critical') criticalCount += 1;
    if (e.severity === 'warning') warningCount += 1;

    if (!byMeter[e.meterId]) {
      byMeter[e.meterId] = { count: 0, highestSeverity: null, events: [] };
    }
    byMeter[e.meterId].count += 1;
    byMeter[e.meterId].events.push(e);
  });

  Object.keys(byMeter).forEach((meterId) => {
    byMeter[meterId].highestSeverity = highestSeverity(byMeter[meterId].events);
    delete byMeter[meterId].events;
  });

  return {
    activeCount,
    acknowledgedCount,
    criticalCount,
    warningCount,
    openCount: openEvents.length,
    todayTriggeredCount,
    byMeter,
  };
}

async function acknowledgeEvents({ companyName, eventIds, meterId, allForCompany }, userId, comment = '') {
  const query = { companyName, status: 'active' };
  if (eventIds?.length) query._id = { $in: eventIds };
  if (meterId) query.meterId = meterId;
  if (!eventIds?.length && !meterId && !allForCompany) {
    const err = new Error('No acknowledge target specified');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date();
  const result = await EnergyMeterAlarmEvent.updateMany(query, {
    $set: {
      status: 'acknowledged',
      acknowledgedAt: now,
      acknowledgedBy: userId || '',
      acknowledgeComment: comment || '',
    },
  });

  return { modifiedCount: result.modifiedCount };
}

async function acknowledgeSingleEvent(eventId, visibleMeters, userId, comment = '') {
  const meterIds = visibleMeters.map((m) => m.deviceId);
  const event = await EnergyMeterAlarmEvent.findOne({
    _id: eventId,
    meterId: { $in: meterIds },
    status: 'active',
  });
  if (!event) {
    const err = new Error('Active alarm event not found');
    err.statusCode = 404;
    throw err;
  }

  event.status = 'acknowledged';
  event.acknowledgedAt = new Date();
  event.acknowledgedBy = userId || '';
  event.acknowledgeComment = comment || '';
  await event.save();
  return serializeEvent(event);
}

async function clearEvent(eventId, visibleMeters) {
  const meterIds = visibleMeters.map((m) => m.deviceId);
  const event = await EnergyMeterAlarmEvent.findOne({
    _id: eventId,
    meterId: { $in: meterIds },
    status: { $in: OPEN_STATUSES },
  });
  if (!event) {
    const err = new Error('Open alarm event not found');
    err.statusCode = 404;
    throw err;
  }

  event.status = 'cleared';
  event.clearedAt = new Date();
  await event.save();

  await EnergyMeterAlarmRuleState.updateOne(
    { ruleId: event.ruleId, boundType: event.boundType },
    { $set: { lastEventId: null, inViolation: false, violationStartedAt: null } }
  );

  return serializeEvent(event);
}

function getMetricsMetadata() {
  return {
    metrics: Object.entries(ALARM_METRICS).map(([key, cfg]) => ({
      key,
      label: cfg.label,
      unit: cfg.unit,
      needsPeriod: !!cfg.needsPeriod,
      defaultHysteresis: cfg.defaultHysteresis,
    })),
    consumptionPeriods: CONSUMPTION_PERIODS,
    severities: ['warning', 'critical'],
    defaultCooldownMinutes: 5,
  };
}

module.exports = {
  evaluateEnergyMeterAlarms,
  listRules,
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  listEvents,
  listActiveEvents,
  buildAlarmSummary,
  acknowledgeEvents,
  acknowledgeSingleEvent,
  clearEvent,
  getMetricsMetadata,
  serializeRule,
  serializeEvent,
  assertMeterAccess,
  formatMeterDisplayName,
};
