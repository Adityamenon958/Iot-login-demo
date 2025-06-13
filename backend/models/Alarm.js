const mongoose = require("mongoose");

const alarmSchema = new mongoose.Schema(
  {
    uid:       { type: String, required: true },   // device UID
    sensorId:  { type: String, required: true },   // "T1", "T2"…
    value:     { type: Number, required: true },   // °C
    level:     { type: String, required: true },   // "LOW LOW", "LOW", …
    vehicleNo: { type: String, default: "" },
    dateISO:   { type: Date, required: true },
    D:         { type: String },                   // original timestamp
  },
  { timestamps: true }
);

alarmSchema.index({ uid: 1, dateISO: -1 });
module.exports = mongoose.model("Alarm", alarmSchema);
