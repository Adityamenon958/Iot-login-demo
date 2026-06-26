const mongoose = require('mongoose');

const ALARM_METRICS = [
  'voltage',
  'current',
  'activePower',
  'powerFactor',
  'frequency',
  'energyConsumption',
];

const CONSUMPTION_PERIODS = ['today', '24h', '7d'];

const energyMeterAlarmRuleSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, index: true },
    meterId: { type: String, required: true, index: true },
    metric: { type: String, required: true, enum: ALARM_METRICS },
    minThreshold: { type: Number, default: null },
    maxThreshold: { type: Number, default: null },
    consumptionPeriod: {
      type: String,
      enum: [...CONSUMPTION_PERIODS, null],
      default: null,
    },
    severity: { type: String, enum: ['warning', 'critical'], default: 'warning' },
    enabled: { type: Boolean, default: true },
    cooldownMinutes: { type: Number, default: 5 },
    triggerDelayMinutes: { type: Number, default: 0 },
    hysteresis: { type: Number, default: null },
    createdBy: { type: String, default: '' },
    label: { type: String, default: '' },
  },
  { timestamps: true }
);

energyMeterAlarmRuleSchema.index({ companyName: 1, meterId: 1, enabled: 1 });

module.exports = mongoose.model('EnergyMeterAlarmRule', energyMeterAlarmRuleSchema);
module.exports.ALARM_METRICS = ALARM_METRICS;
module.exports.CONSUMPTION_PERIODS = CONSUMPTION_PERIODS;
