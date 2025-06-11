// backend/models/LevelSensor.js
const mongoose = require('mongoose');

const levelSensorSchema = new mongoose.Schema(
  {
    /* ⬇️ keep the raw string sent by the device */
    D: String,              // "24/07/2024 11:38:22"
    uid: String,            // device UID

    /* numeric fields (stored exactly as you receive them) */
    level: Number,
    ts:   String,           // if TRB245 sends ISO – keep as String

    data:   [Number],       // array of readings
    address: Number,
    vehicleNo: String,

    /* ⭐ Parsed ISO date so we can sort & index fast */
    dateISO: Date           // we’ll populate this on insert (see server.js)
  },
  { timestamps: true }
);

/* 🔑 Indexes for fast queries */
levelSensorSchema.index({ dateISO: -1 });               // newest first
levelSensorSchema.index({ uid: 1 });
levelSensorSchema.index({ companyUid: 1 });             // (added below)
levelSensorSchema.index({
  address: 1,
  vehicleNo: 1,
  level: 1
}); // compound helps mixed-column search

module.exports = mongoose.model('LevelSensor', levelSensorSchema);
