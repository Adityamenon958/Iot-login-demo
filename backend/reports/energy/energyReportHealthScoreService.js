const { roundTo, PF_DRILLDOWN_BANDS, VOLTAGE_BAND } = require('../../utils/meterInsightsUtils');

function clampScore(value) {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scorePowerFactor(avgPf, meters) {
  if (avgPf == null) return 50;
  let score = 50;
  if (avgPf >= PF_DRILLDOWN_BANDS.healthy) score = 95;
  else if (avgPf >= PF_DRILLDOWN_BANDS.warning) score = 75;
  else if (avgPf >= 0.8) score = 55;
  else score = 30;

  const belowCount = meters.filter((m) => m.avgPowerFactor != null && m.avgPowerFactor < 0.9).length;
  const belowPct = meters.length ? (belowCount / meters.length) * 100 : 0;
  return clampScore(score - belowPct * 0.2);
}

function scoreVoltageStability(avgVoltage, meters) {
  if (avgVoltage == null) return 70;
  const deviation = Math.abs(avgVoltage - 230);
  let score = 100 - deviation * 2;
  const outOfRange = meters.filter((m) => {
    if (m.avgVoltage == null) return false;
    return m.avgVoltage < VOLTAGE_BAND.lower || m.avgVoltage > VOLTAGE_BAND.upper;
  }).length;
  const penalty = meters.length ? (outOfRange / meters.length) * 30 : 0;
  return clampScore(score - penalty);
}

function scoreAlarmFrequency(alarmTotal, meterCount, periodDays, threshold) {
  if (!meterCount || !periodDays) return 100;
  const rate = alarmTotal / meterCount / periodDays;
  if (rate <= 0) return 100;
  if (rate <= threshold * 0.5) return 85;
  if (rate <= threshold) return 70;
  if (rate <= threshold * 2) return 50;
  return clampScore(30 - (rate - threshold) * 10);
}

function scoreMeterAvailability(onlineMeters, totalMeters) {
  if (!totalMeters) return 0;
  return clampScore((onlineMeters / totalMeters) * 100);
}

function scoreOfflineDuration(meters) {
  if (!meters.length) return 100;
  const offlineHours = meters
    .filter((m) => !m.online && m.offlineHours != null)
    .map((m) => m.offlineHours);
  if (!offlineHours.length) return 100;
  const avgOffline = offlineHours.reduce((s, h) => s + h, 0) / offlineHours.length;
  if (avgOffline <= 1) return 95;
  if (avgOffline <= 6) return 80;
  if (avgOffline <= 24) return 60;
  if (avgOffline <= 72) return 40;
  return 20;
}

function getHealthLabel(score, labels) {
  const sorted = [...labels].sort((a, b) => b.min - a.min);
  const match = sorted.find((l) => score >= l.min);
  return match?.label || 'Poor';
}

function computeEnergyHealthScore(fleetSummary, meters, alarms, periodDays, config) {
  const weights = config.healthScore.weights;
  const subScores = {
    powerFactor: {
      score: scorePowerFactor(fleetSummary.avgPowerFactor, meters),
      weight: weights.powerFactor,
    },
    voltageStability: {
      score: scoreVoltageStability(fleetSummary.avgVoltage, meters),
      weight: weights.voltageStability,
    },
    alarmFrequency: {
      score: scoreAlarmFrequency(
        alarms.summary?.total || 0,
        meters.length,
        periodDays,
        config.healthScore.alarmRateThresholdPerMeterPerDay
      ),
      weight: weights.alarmFrequency,
    },
    meterAvailability: {
      score: scoreMeterAvailability(fleetSummary.onlineMeters, meters.length),
      weight: weights.meterAvailability,
    },
    offlineDuration: {
      score: scoreOfflineDuration(meters),
      weight: weights.offlineDuration,
    },
  };

  const score = clampScore(
    Object.values(subScores).reduce((sum, s) => sum + s.score * s.weight, 0)
  );

  return {
    score,
    label: getHealthLabel(score, config.healthScore.labels),
    subScores,
  };
}

module.exports = { computeEnergyHealthScore };
