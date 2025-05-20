// backend/models/LevelSensor.js

const mongoose = require('mongoose');

const levelSensorSchema = new mongoose.Schema({
  D: {
    type: String,
    required: true
  },
  address: {
    type: Number,
    required: true
  },
  data: {
    type: [Number],
    required: true
  },
  vehicleNo: {
    type: String,
    required: true
  },
  uid: {              // <-- new field added here
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LevelSensor', levelSensorSchema);
