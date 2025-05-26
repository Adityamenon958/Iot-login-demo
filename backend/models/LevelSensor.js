// backend/models/LevelSensor.js

const mongoose = require('mongoose');

const levelSensorSchema = new mongoose.Schema({
  D: {
    type: String
  },
  uid: {
    type: String
  },
  level: {
    type: Number
  },
  ts: {
    type: String  // or `Date` if you'd like to parse ISO strings
  },
  data: {
    type: [Number]
  },
  address: {
    type: Number
  },
  vehicleNo: {
    type: String
  }
}, {
  timestamps: true  // adds createdAt and updatedAt automatically
});

module.exports = mongoose.model('LevelSensor', levelSensorSchema);
