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
  // ✅ 'crane' | 'elevator' | 'energyMeter'
  deviceType: {
    type: String,
    enum: ['crane', 'elevator', 'energyMeter'],
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
  overrideErrorCode: { type: String, trim: true, default: null },

  // ✅ Energy meter only
  machineProfile: {
    type: String,
    enum: ['warehouse', 'cnc', 'compressor', 'conveyor'],
    default: 'warehouse',
  },
  siteName: { type: String, trim: true, default: '' },
  plantName: { type: String, trim: true, default: '' },
  machineName: { type: String, trim: true, default: '' },
  energyBaseReading: { type: Number, default: null },
  intervalSeconds: {
    type: Number,
    enum: [30, 60, 120, 180, 300],
    default: 60,
  },
  // Room-aware industrial simulator
  energySimMode: {
    type: String,
    enum: ['room', 'single'],
    default: 'single',
  },
  roomType: {
    type: String,
    enum: ['office', 'warehouse', 'manufacturing', 'retail'],
    default: 'office',
  },
  scheduleTimezone: { type: String, default: 'Asia/Kolkata' },
  appliances: [{
    type: { type: String, required: true },
    count: { type: Number, min: 1, default: 1 },
    ratedKwOverride: { type: Number, default: null },
    stateDistribution: {
      running: { type: Number, default: 80 },
      idle: { type: Number, default: 15 },
      stopped: { type: Number, default: 5 },
      maintenance: { type: Number, default: 0 },
    },
  }],
  singleApplianceType: { type: String, default: 'ac_split' },
  singleApplianceRatedKwOverride: { type: Number, default: null },
  singleStateDistribution: {
    running: { type: Number, default: 80 },
    idle: { type: Number, default: 15 },
    stopped: { type: Number, default: 5 },
    maintenance: { type: Number, default: 0 },
  },
  occupancyPercent: { type: Number, min: 0, max: 100, default: 100 },
  minVoltage: { type: Number, default: 220 },
  maxVoltage: { type: Number, default: 240 },
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Index for faster queries
simulatorDeviceSchema.index({ deviceId: 1 });
simulatorDeviceSchema.index({ isRunning: 1 });
simulatorDeviceSchema.index({ deviceType: 1 });

module.exports = mongoose.model('SimulatorDevice', simulatorDeviceSchema);
