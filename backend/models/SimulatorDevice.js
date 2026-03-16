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
  // ✅ Crane: required. Elevator: not used (can be 0,0)
  latitude: {
    type: Number,
    required: false,
    min: -90,
    max: 90,
    default: 0
  },
  longitude: {
    type: Number,
    required: false,
    min: -180,
    max: 180,
    default: 0
  },
  // ✅ 'crane' | 'elevator' - existing docs without this field are treated as crane
  deviceType: {
    type: String,
    enum: ['crane', 'elevator'],
    default: 'crane'
  },
  // ✅ Elevator only: display location string (e.g. "Building A Lobby")
  location: {
    type: String,
    trim: true,
    default: ''
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
  // ✅ Crane only: profile A or B for state mapping
  profile: {
    type: String,
    enum: ['A', 'B'],
    default: 'A'
  },
  isRunning: {
    type: Boolean,
    default: false
  },
  // ✅ Elevator only: current floor for cycling 0..24 (updated each tick)
  elevatorCurrentFloor: {
    type: Number,
    min: 0,
    max: 24,
    default: 0
  },
  // ✅ Elevator only: live override for demo – if set, next tick uses these instead of computed
  overrideReg65: { type: Number, default: null },
  overrideReg66: { type: Number, default: null },
  overrideErrorCode: { type: String, trim: true, default: null }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Index for faster queries
simulatorDeviceSchema.index({ deviceId: 1 });
simulatorDeviceSchema.index({ isRunning: 1 });
simulatorDeviceSchema.index({ deviceType: 1 });

module.exports = mongoose.model('SimulatorDevice', simulatorDeviceSchema);
