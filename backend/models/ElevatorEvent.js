// backend/models/ElevatorEvent.js
// ✅ Updated for hex data format with location string
const mongoose = require("mongoose");

const elevatorEventSchema = new mongoose.Schema(
  {
    elevatorCompany: { 
      type: String, 
      required: true,
      index: true 
    },
    elevatorId: { 
      type: String, 
      required: true, 
      index: true 
    },
    location: {
      type: String,
      required: true,
      index: true
    },
    timestamp: {
      type: Date,
      required: true,
      index: true
    },
    data: { 
      type: [String], // Array of hex values
      required: true,
      default: [] 
    }
  },
  {
    timestamps: true,
    collection: "elevatorevents",
    strict: false
  }
);

// ✅ Essential indexes for performance
elevatorEventSchema.index({ elevatorCompany: 1, elevatorId: 1 });
elevatorEventSchema.index({ elevatorCompany: 1, timestamp: -1 });
elevatorEventSchema.index({ location: 1, timestamp: -1 });
elevatorEventSchema.index({ timestamp: -1 });

module.exports = mongoose.model("ElevatorEvent", elevatorEventSchema);


