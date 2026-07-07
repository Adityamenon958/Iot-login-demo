const mongoose = require('mongoose');

const energyReportSchema = new mongoose.Schema(
  {
    reportId: { type: String, required: true, unique: true, index: true },
    companyName: { type: String, required: true, index: true },
    generatedBy: {
      userId: String,
      name: String,
      email: String,
    },
    scope: { type: String, enum: ['fleet', 'meter'], default: 'fleet' },
    meterIds: [String],
    reportType: { type: String, required: true },
    periodPreset: { type: String, required: true },
    periodLabel: String,
    from: Date,
    to: Date,
    format: { type: String, default: 'pdf' },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'completed',
      index: true,
    },
    error: String,
    energyHealthScore: Number,
    meterCount: Number,
    generationDurationMs: Number,
    fileName: String,
    storageKey: { type: String, default: null },
    completedAt: Date,
  },
  { timestamps: true }
);

energyReportSchema.index({ companyName: 1, createdAt: -1 });

module.exports = mongoose.model('EnergyReport', energyReportSchema);
