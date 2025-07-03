// backend/models/CraneLog.js
const mongoose = require("mongoose");

const CraneLogSchema = new mongoose.Schema({
  DeviceID:      { type: String, required: true },
  Timestamp:     { type: String, required: true }, // Store as string for now, can convert to Date if needed
  Date:          { type: String, required: true },
  Time:          { type: String, required: true },
  Longitude:     { type: String, required: true },
  Latitude:      { type: String, required: true },
  DigitalInput1: { type: String, required: true },
  DigitalInput2: { type: String, required: true },
}, { timestamps: true }); // adds createdAt, updatedAt

module.exports = mongoose.model("CraneLog", CraneLogSchema);