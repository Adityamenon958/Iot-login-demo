const mongoose = require('mongoose');

const energyMeterLogSchema = new mongoose.Schema(
  {
    meterId: { type: String, index: true },
    uid: { type: String, index: true },
    companyName: { type: String, index: true },

    siteName: { type: String, default: '' },
    plantName: { type: String, default: '' },
    machineName: { type: String, default: '' },
    location: { type: String, default: '' },
    phaseType: { type: String, default: 'single' },

    dataSource: {
      type: String,
      enum: ['simulator', 'device'],
      required: true,
    },

    D: String,
    timestamp: { type: Date, index: true },
    dateISO: { type: Date, index: true },

    rawValues: [Number],
    readings: {
      type: Object,
      default: {},
    },

    rawPayload: { type: mongoose.Schema.Types.Mixed, required: true },
    parseStatus: {
      type: String,
      enum: ['parsed', 'partial', 'raw_only'],
      default: 'raw_only',
    },
    receivedAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'energymeterlogs',
    strict: false,
  }
);

energyMeterLogSchema.pre('validate', function enforceDataSource(next) {
  if (this.isNew && !this.dataSource) {
    return next(new Error('dataSource is required for new EnergyMeterLog records'));
  }
  next();
});

energyMeterLogSchema.index({ companyName: 1, timestamp: -1 });
energyMeterLogSchema.index({ meterId: 1, timestamp: -1 });
energyMeterLogSchema.index({ uid: 1, timestamp: -1 });
energyMeterLogSchema.index({ meterId: 1, dataSource: 1, timestamp: -1 });
energyMeterLogSchema.index({ companyName: 1, dataSource: 1, timestamp: -1 });
energyMeterLogSchema.index({ dataSource: 1, timestamp: -1 });

module.exports = mongoose.model('EnergyMeterLog', energyMeterLogSchema);
