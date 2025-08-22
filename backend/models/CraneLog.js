// backend/models/CraneLog.js - UPDATED FOR DATE TIMESTAMPS
const mongoose = require("mongoose");

// ✅ Updated schema with Date type for Timestamp
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
    type: Date,              // ✅ CHANGED: String → Date
    required: true,
    index: true              // ✅ ADDED: Enable indexing for fast queries
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

// ✅ Updated indexes for better performance with Date type
CraneLogSchema.index({ craneCompany: 1, DeviceID: 1 });
CraneLogSchema.index({ craneCompany: 1, DeviceID: 1, Uid: 1 });
CraneLogSchema.index({ craneCompany: 1, Timestamp: -1 }); // ✅ Date indexing
CraneLogSchema.index({ Timestamp: -1 });                  // ✅ Global timestamp index

// ✅ Add a pre-save hook to log craneCompany
CraneLogSchema.pre('save', function(next) {
  console.log('🔍 Debug - Pre-save hook - craneCompany:', this.craneCompany);
  next();
});

// ✅ Export the model
module.exports = mongoose.model("CraneLog", CraneLogSchema);