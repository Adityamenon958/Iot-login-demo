const mongoose = require('mongoose');

const elevatorZoneSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

elevatorZoneSchema.index({ companyName: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('ElevatorZone', elevatorZoneSchema);
