// backend/models/CraneLog.js - COMPLETELY REWRITTEN
const mongoose = require("mongoose");

// ✅ Create a completely new schema
const CraneLogSchema = new mongoose.Schema({
  craneCompany: {
    type: String,
    required: true
  },
  DeviceID: {
    type: String,
    required: true
  },
  Timestamp: {
    type: String,
    required: true
  },
  Longitude: {
    type: String,
    required: true
  },
  Latitude: {
    type: String,
    required: true
  },
  DigitalInput1: {
    type: String,
    required: true
  },
  DigitalInput2: {
    type: String,
    required: true
  }
}, { 
  timestamps: true,
  collection: 'cranelogs' // Force specific collection name
});

// ✅ Add indexes
CraneLogSchema.index({ craneCompany: 1, DeviceID: 1 });
CraneLogSchema.index({ craneCompany: 1, Timestamp: -1 });

// ✅ Add a pre-save hook to log craneCompany
CraneLogSchema.pre('save', function(next) {
  console.log('🔍 Debug - Pre-save hook - craneCompany:', this.craneCompany);
  next();
});

// ✅ Export the model
module.exports = mongoose.model("CraneLog", CraneLogSchema);