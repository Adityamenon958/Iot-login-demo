const mongoose = require('mongoose');

const parameterSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    key: { type: String, required: true },
    label: { type: String, required: true },
    unit: { type: String, default: '' },
    scale: { type: Number, default: 1 },
  },
  { _id: false }
);

const energyMeterParameterMapSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      enum: ['default', 'device'],
      default: 'default',
    },
    meterId: { type: String, default: null, index: true },
    parameters: {
      type: [parameterSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'energymeterparametermaps',
  }
);

energyMeterParameterMapSchema.index({ scope: 1, meterId: 1 }, { unique: true });

module.exports = mongoose.model('EnergyMeterParameterMap', energyMeterParameterMapSchema);
