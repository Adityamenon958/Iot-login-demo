const mongoose = require('mongoose');

const energyMeterAlarmEventSchema = new mongoose.Schema(
  {
    ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'EnergyMeterAlarmRule', required: true, index: true },
    companyName: { type: String, required: true, index: true },
    meterId: { type: String, required: true, index: true },
    meterName: { type: String, default: '' },
    metric: { type: String, required: true },
    boundType: { type: String, enum: ['min', 'max'], required: true },
    conditionLabel: { type: String, required: true },
    threshold: { type: Number, required: true },
    actualValue: { type: Number, required: true },
    consumptionPeriod: { type: String, default: null },
    severity: { type: String, enum: ['warning', 'critical'], default: 'warning' },
    message: { type: String, default: '' },
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'cleared'],
      default: 'active',
      index: true,
    },
    triggeredAt: { type: Date, required: true, index: true },
    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: { type: String, default: '' },
    acknowledgeComment: { type: String, default: '' },
    clearedAt: { type: Date, default: null },
    triggerLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'EnergyMeterLog', default: null },
    notificationStatus: {
      type: String,
      enum: ['none', 'pending', 'sent', 'failed'],
      default: 'none',
    },
    pendingChannels: [{ type: String }],
    notifications: [
      {
        channel: String,
        status: String,
        sentAt: Date,
        error: String,
      },
    ],
  },
  { timestamps: true }
);

energyMeterAlarmEventSchema.index({ companyName: 1, meterId: 1, status: 1, triggeredAt: -1 });
energyMeterAlarmEventSchema.index({ ruleId: 1, boundType: 1, status: 1 });
energyMeterAlarmEventSchema.index({ companyName: 1, status: 1, severity: 1 });

module.exports = mongoose.model('EnergyMeterAlarmEvent', energyMeterAlarmEventSchema);
