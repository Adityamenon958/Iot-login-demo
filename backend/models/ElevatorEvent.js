// backend/models/ElevatorEvent.js
// ✅ Raw elevator log store for quick verification of gateway ingestion
const mongoose = require("mongoose");

const elevatorEventSchema = new mongoose.Schema(
  {
    elevatorCompany: { type: String, index: true },
    DeviceID: { type: String, required: true, index: true },
    dataType: { type: String, index: true },

    // Timestamps
    rawTimestamp: { type: String },
    timestamp: { type: Date, index: true },

    // Data can be sent as a JSON string or an array; we normalize to [Number]
    data: { type: [Number], default: [] },

    // Persist the full original item for auditing
    raw: { type: Object, default: {} }
  },
  {
    timestamps: true,
    collection: "elevatorevents",
    strict: false
  }
);

elevatorEventSchema.index({ DeviceID: 1, createdAt: -1 });

module.exports = mongoose.model("ElevatorEvent", elevatorEventSchema);


