function buildRecommendations(fleetSummary, meters, alarms, periodDays, config) {
  const rules = config.recommendations;
  const recs = [];

  const avgPf = fleetSummary.avgPowerFactor;
  if (avgPf != null && avgPf < rules.lowFleetPfThreshold) {
    recs.push({
      priority: 'high',
      ruleId: 'low_fleet_pf',
      title: 'Low Fleet Power Factor',
      description: `Average power factor is ${avgPf} (below ${rules.lowFleetPfThreshold}). Consider power factor correction equipment.`,
    });
  }

  meters
    .filter((m) => m.avgPowerFactor != null && m.avgPowerFactor < rules.meterLowPfThreshold)
    .slice(0, 3)
    .forEach((m) => {
      recs.push({
        priority: 'medium',
        ruleId: 'meter_low_pf',
        title: 'Poor Meter Power Factor',
        description: `${m.meterId} has power factor ${m.avgPowerFactor}. Investigate inductive loads.`,
        meterId: m.meterId,
      });
    });

  const alarmTotal = alarms?.summary?.total || 0;
  const alarmRate = meters.length && periodDays ? alarmTotal / meters.length / periodDays : 0;
  if (alarmRate > rules.highAlarmRatePerMeterPerDay) {
    recs.push({
      priority: 'high',
      ruleId: 'high_alarm_rate',
      title: 'Elevated Alarm Frequency',
      description: 'Alarm frequency is above normal. Review threshold settings and affected meters.',
    });
  }

  meters
    .filter((m) => m.voltageDeviation != null && m.voltageDeviation > rules.voltageDeviationThreshold)
    .slice(0, 2)
    .forEach((m) => {
      recs.push({
        priority: 'medium',
        ruleId: 'voltage_variation',
        title: 'High Voltage Variation',
        description: `${m.meterId} shows voltage deviation of ${m.voltageDeviation}V from nominal. Check supply stability.`,
        meterId: m.meterId,
      });
    });

  const avgKwh = meters.length
    ? meters.reduce((s, m) => s + (m.totalEnergyKwh || 0), 0) / meters.length
    : 0;
  meters
    .filter((m) => avgKwh > 0 && m.totalEnergyKwh > avgKwh * rules.consumptionSpikeMultiplier)
    .slice(0, 2)
    .forEach((m) => {
      recs.push({
        priority: 'medium',
        ruleId: 'consumption_spike',
        title: 'Unusually High Consumption',
        description: `${m.meterId} consumed ${m.totalEnergyKwh} kWh, significantly above fleet average. Verify load and operating hours.`,
        meterId: m.meterId,
      });
    });

  const offlineMeters = meters.filter(
    (m) => !m.online && m.offlineHours != null && m.offlineHours > rules.offlineHoursThreshold
  );
  if (offlineMeters.length) {
    recs.push({
      priority: 'medium',
      ruleId: 'offline_meters',
      title: 'Offline Meters',
      description: `${offlineMeters.length} meter(s) have not communicated for over ${rules.offlineHoursThreshold} hours. Check connectivity.`,
    });
  }

  const activeCritical = alarms?.summary?.active || 0;
  const criticalOpen = meters.reduce((s, m) => s + (m.criticalAlarms || 0), 0);
  if (criticalOpen > 0 || (alarms?.summary?.critical && alarms.summary.active > 0)) {
    recs.push({
      priority: 'high',
      ruleId: 'critical_alarms_open',
      title: 'Open Critical Alarms',
      description: `${alarms.summary.active} alarm(s) remain open, including critical events. Prioritize investigation.`,
    });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return recs
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 8);
}

module.exports = { buildRecommendations };
