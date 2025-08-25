// backend/models/CraneLog.js - FIXED VERSION
const mongoose = require("mongoose");

// ✅ Fixed schema without problematic pre-save hooks
const CraneLogSchema = new mongoose.Schema({
  craneCompany: {
    type: String,
    required: true
  },
  DeviceID: {
    type: String,
    required: true
  },
  Uid: {
    type: String,
    required: false // Optional unique device identifier from payload
  },
  Timestamp: {
    type: Date,              // ✅ Date type for storage
    required: true,
    index: true              // ✅ Indexed for fast queries
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
  },
  maintenance: {
    type: String,
    required: false
  }
}, { 
  timestamps: true,
  collection: 'cranelogs', // Force specific collection name
  strict: false // Allow extra fields to prevent validation errors
});

// ✅ Essential indexes for performance
CraneLogSchema.index({ craneCompany: 1, DeviceID: 1 });
CraneLogSchema.index({ craneCompany: 1, Timestamp: -1 });
CraneLogSchema.index({ Timestamp: -1 }); // Global timestamp index

// ✅ Export the fixed model
module.exports = mongoose.model("CraneLog", CraneLogSchema);