const mongoose = require('mongoose');

const simulatorDeviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180
  },
  state: {
    type: String,
    enum: ['working', 'idle', 'maintenance'],
    default: 'idle'
  },
  frequencyMinutes: {
    type: Number,
    enum: [1, 2, 5, 10, 15, 30],
    default: 1
  },
  padTimestamp: {
    type: Boolean,
    default: false
  },
  jitter: {
    type: Boolean,
    default: false
  },
  isRunning: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Index for faster queries
simulatorDeviceSchema.index({ deviceId: 1 });
simulatorDeviceSchema.index({ isRunning: 1 });

module.exports = mongoose.model('SimulatorDevice', simulatorDeviceSchema);
