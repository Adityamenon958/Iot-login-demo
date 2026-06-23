const mongoose = require('mongoose');

const energyMeterAlarmRuleStateSchema = new mongoose.Schema(
  {
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'EnergyMeterAlarmRule', required: true },
    boundType: { type: String, enum: ['min', 'max'], required: true },
    inViolation: { type: Boolean, default: false },
    violationStartedAt: { type: Date, default: null },
    lastEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'EnergyMeterAlarmEvent', default: null },
    lastTriggeredAt: { type: Date, default: null },
    lastEvaluatedAt: { type: Date, default: null },
    lastValue: { type: Number, default: null },
  },
  { timestamps: true }
);

energyMeterAlarmRuleStateSchema.index({ ruleId: 1, boundType: 1 }, { unique: true });

module.exports = mongoose.model('EnergyMeterAlarmRuleState', energyMeterAlarmRuleStateSchema);
