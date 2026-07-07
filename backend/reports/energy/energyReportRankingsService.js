const { roundTo } = require('../../utils/meterInsightsUtils');

const RANKING_LIMIT = 5;

function buildRankedList(items, valueKey, unit, totalForShare = null) {
  return items
    .filter((item) => item[valueKey] != null && Number.isFinite(Number(item[valueKey])) && Number(item[valueKey]) > 0)
    .sort((a, b) => Number(b[valueKey]) - Number(a[valueKey]))
    .slice(0, RANKING_LIMIT)
    .map((item, idx) => ({
      rank: idx + 1,
      meterId: item.meterId,
      machineName: item.machineName || item.meterId,
      siteName: item.siteName || '',
      value: roundTo(item[valueKey], 2),
      unit,
      sharePct:
        totalForShare && totalForShare > 0
          ? roundTo((Number(item[valueKey]) / totalForShare) * 100, 1)
          : null,
      peakPowerAt: item.peakPowerAt || null,
      criticalAlarms: item.criticalAlarms,
      warningAlarms: item.warningAlarms,
      offlineHours: item.offlineHours,
    }));
}

function buildRankings(meters, totalEnergyKwh) {
  return {
    topEnergyConsumers: buildRankedList(meters, 'totalEnergyKwh', 'kWh', totalEnergyKwh),
    topPeakDemand: buildRankedList(meters, 'peakPowerKw', 'kW'),
    topAlarmSources: buildRankedList(meters, 'alarmCount', 'alarms'),
    worstPowerFactor: meters
      .filter((m) => m.avgPowerFactor != null && m.avgPowerFactor < 0.9)
      .sort((a, b) => a.avgPowerFactor - b.avgPowerFactor)
      .slice(0, RANKING_LIMIT)
      .map((item, idx) => ({
        rank: idx + 1,
        meterId: item.meterId,
        machineName: item.machineName,
        siteName: item.siteName || '',
        value: roundTo(item.avgPowerFactor, 2),
        unit: '',
      })),
    longestOffline: meters
      .filter((m) => !m.online && m.offlineHours != null)
      .sort((a, b) => b.offlineHours - a.offlineHours)
      .slice(0, RANKING_LIMIT)
      .map((item, idx) => ({
        rank: idx + 1,
        meterId: item.meterId,
        machineName: item.machineName,
        siteName: item.siteName || '',
        value: item.offlineHours,
        unit: 'hours',
      })),
  };
}

module.exports = { buildRankings };
