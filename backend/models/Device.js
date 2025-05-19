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
  location: {
    type: String,
    required: true,
  },
  frequency: {
    type: String,
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Device', deviceSchema);
