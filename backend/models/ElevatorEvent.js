// backend/models/ElevatorEvent.js
// ✅ Elevator log store matching CraneLog pattern
const mongoose = require("mongoose");

const elevatorEventSchema = new mongoose.Schema(
  {
    elevatorCompany: { 
      type: String, 
      required: true,
      index: true 
    },
    DeviceID: { 
      type: String, 
      required: true, 
      index: true 
    },
    dataType: { 
      type: String, 
      required: true,
      index: true 
    },
    Timestamp: {
      type: Date,
      required: true,
      index: true
    },
    data: { 
      type: [Number], 
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

// ✅ Essential indexes for performance (matching CraneLog pattern)
elevatorEventSchema.index({ elevatorCompany: 1, DeviceID: 1 });
elevatorEventSchema.index({ elevatorCompany: 1, Timestamp: -1 });
elevatorEventSchema.index({ Timestamp: -1 });

module.exports = mongoose.model("ElevatorEvent", elevatorEventSchema);


