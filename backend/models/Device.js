const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
  },
  uid: {
    type: String,
    required: true,
    unique: true, // prevents duplicate UID
  },
  deviceId: {
    type: String,
    required: true,
  },
  deviceType: {
    type: String,
    required: true,
  },
  // ✅ Optional: elevator devices can belong to one zone (ElevatorZone)
  elevatorZoneId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ElevatorZone',
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('Device', deviceSchema);
