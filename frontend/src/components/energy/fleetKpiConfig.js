import { CONSUMPTION_PERIODS } from './meterParameterConfig';

export const FLEET_KPI_CONFIG = {
  currentPowerConsumption: {
    type: 'metric',
    metricKey: 'activePower',
    title: 'Fleet Active Power',
    unit: 'kW',
    decimals: 2,
    useRangePills: true,
  },
  todayEnergyConsumption: {
    type: 'consumption',
    title: 'Fleet Energy Consumption',
    unit: 'kWh',
    decimals: 2,
    periods: CONSUMPTION_PERIODS,
  },
  averagePowerFactor: {
    type: 'metric',
    metricKey: 'powerFactor',
    title: 'Fleet Power Factor',
    unit: '',
    decimals: 2,
    useRangePills: true,
  },
  averageVoltage: {
    type: 'metric',
    metricKey: 'voltage',
    title: 'Fleet Voltage',
    unit: 'V',
    decimals: 1,
    useRangePills: true,
  },
  averageFrequency: {
    type: 'metric',
    metricKey: 'frequency',
    title: 'Fleet Frequency',
    unit: 'Hz',
    decimals: 2,
    useRangePills: true,
    lightweight: true,
  },
};

export const RANKING_LABELS = {
  topConsumers: 'Top Consumers',
  topConsumersToday: 'Top Consumers Today',
  topConsumersThisMonth: 'Top Consumers This Month',
  mostUnstable: 'Most Unstable Meters',
  lowestVoltage: 'Lowest Voltage Meters',
  worstPf: 'Worst PF Meters',
  bestPf: 'Best PF Meters',
  mostUnstableFrequency: 'Most Unstable Frequency Meters',
};

export const FLEET_RANKING_KEYS = {
  currentPowerConsumption: ['topConsumers'],
  todayEnergyConsumption: ['topConsumersToday', 'topConsumersThisMonth'],
  averagePowerFactor: ['worstPf', 'bestPf'],
  averageVoltage: ['mostUnstable', 'lowestVoltage'],
  averageFrequency: ['mostUnstableFrequency'],
};

export function getFleetKpiConfig(kpiKey) {
  return FLEET_KPI_CONFIG[kpiKey] || null;
}

export function getFleetRankingKeys(kpiKey) {
  return FLEET_RANKING_KEYS[kpiKey] || [];
}
