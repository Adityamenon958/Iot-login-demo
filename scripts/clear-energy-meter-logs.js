/**
 * Delete all energy meter telemetry logs (energymeterlogs collection).
 *
 * Usage:
 *   node scripts/clear-energy-meter-logs.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../backend/db');
const EnergyMeterLog = require('../backend/models/EnergyMeterLog');

async function main() {
  await connectDB();
  const countBefore = await EnergyMeterLog.countDocuments();
  const { deletedCount } = await EnergyMeterLog.deleteMany({});
  console.log(`✅ Deleted ${deletedCount} energy meter log(s) (had ${countBefore} before).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Failed to clear energy meter logs:', err.message);
  process.exit(1);
});
