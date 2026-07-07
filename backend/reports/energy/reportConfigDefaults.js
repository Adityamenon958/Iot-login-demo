const DEFAULT_REPORT_CONFIG = {
  healthScore: {
    weights: {
      powerFactor: 0.25,
      voltageStability: 0.2,
      alarmFrequency: 0.25,
      meterAvailability: 0.2,
      offlineDuration: 0.1,
    },
    labels: [
      { min: 90, label: 'Excellent' },
      { min: 75, label: 'Good' },
      { min: 60, label: 'Fair' },
      { min: 0, label: 'Poor' },
    ],
    alarmRateThresholdPerMeterPerDay: 0.5,
  },
  recommendations: {
    lowFleetPfThreshold: 0.9,
    meterLowPfThreshold: 0.8,
    highAlarmRatePerMeterPerDay: 0.5,
    voltageDeviationThreshold: 15,
    consumptionSpikeMultiplier: 1.5,
    offlineHoursThreshold: 24,
  },
  sustainability: {
    enabled: false,
    emissionFactorKgCo2PerKwh: null,
    esgPlaceholder: true,
  },
  tariff: {
    enabled: false,
    currency: 'INR',
    ratePerKwh: null,
    slabs: [],
  },
};

module.exports = { DEFAULT_REPORT_CONFIG };
