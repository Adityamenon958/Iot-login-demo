export const CONSUMPTION_PERIODS = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
];

export const PARAMETER_DRILLDOWN = {
  energy: {
    type: 'consumption',
    title: 'Energy Consumption',
    unit: 'kWh',
    decimals: 2,
  },
  activePower: {
    type: 'metric',
    metricKey: 'activePower',
    title: 'Active Power',
    unit: 'kW',
    decimals: 2,
  },
  voltage: {
    type: 'metric',
    metricKey: 'voltage',
    title: 'Voltage',
    unit: 'V',
    decimals: 1,
  },
  current: {
    type: 'metric',
    metricKey: 'current',
    title: 'Current',
    unit: 'A',
    decimals: 2,
  },
  powerFactor: {
    type: 'metric',
    metricKey: 'powerFactor',
    title: 'Power Factor',
    unit: '',
    decimals: 2,
  },
  frequency: {
    type: 'metric',
    metricKey: 'frequency',
    title: 'Frequency',
    unit: 'Hz',
    decimals: 2,
    lightweight: true,
  },
};

export function getParameterDrilldown(key) {
  return PARAMETER_DRILLDOWN[key] || null;
}

export const VALUE_DECIMALS = {
  voltage: 1,
  current: 2,
  activePower: 2,
  energy: 2,
  powerFactor: 2,
  frequency: 2,
};
