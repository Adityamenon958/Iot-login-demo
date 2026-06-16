/**
 * Demo seed for energy meter dashboard.
 *
 * Usage:
 *   node scripts/seed-energy-meter-demo.js          # seed devices + post once
 *   node scripts/seed-energy-meter-demo.js --loop   # seed + post every 3 min
 *
 * Manual test (PowerShell):
 *   Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/energy-meter/log" -Method POST `
 *     -ContentType "application/json" `
 *     -Body '{"Energy Meter_1":"10/06/2026 13:52:33,[2300,1250,285,62000]"}'
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../backend/db');
const Device = require('../backend/models/Device');
const EnergyMeterParameterMap = require('../backend/models/EnergyMeterParameterMap');
const { DEFAULT_PARAMETERS } = require('../backend/utils/energyMeterUtils');
const { buildEnergyMeterPayload } = require('../backend/utils/energyMeterSim');

const PORT = process.env.PORT || 8080;
const BASE_URL = process.env.ENERGY_SEED_BASE_URL || `http://127.0.0.1:${PORT}`;
const LOOP = process.argv.includes('--loop');

const DEMO_METERS = [
  {
    companyName: 'Gsn Soln',
    deviceId: 'Energy Meter_1',
    uid: 'GS-EM1',
    deviceType: 'energyMeter',
    siteName: 'Demo Warehouse',
    plantName: 'Demo Plant',
    machineName: 'Packaging Line 1',
    location: 'Floor A',
    phaseType: 'single',
    machineProfile: 'warehouse',
    energyBaseReading: 6200,
  },
  {
    companyName: 'Gsn Soln',
    deviceId: 'Energy Meter_2',
    uid: 'GS-EM2',
    deviceType: 'energyMeter',
    siteName: 'Demo Warehouse',
    plantName: 'Demo Plant',
    machineName: 'CNC Machine 2',
    location: 'Floor B',
    phaseType: 'single',
    machineProfile: 'cnc',
    energyBaseReading: 7100,
  },
  {
    companyName: 'Gsn Soln',
    deviceId: 'Energy Meter_3',
    uid: 'GS-EM3',
    deviceType: 'energyMeter',
    siteName: 'Plant B',
    plantName: 'Assembly Unit',
    machineName: 'Assembly Line 3',
    location: 'Bay 12',
    phaseType: 'single',
    machineProfile: 'conveyor',
    energyBaseReading: 5800,
  },
];

async function seedDevices() {
  for (const meter of DEMO_METERS) {
    const { machineProfile, energyBaseReading, ...deviceFields } = meter;
    await Device.findOneAndUpdate(
      { uid: meter.uid },
      deviceFields,
      { upsert: true, new: true }
    );
    console.log(`✅ Device upserted: ${meter.deviceId}`);
  }

  await EnergyMeterParameterMap.findOneAndUpdate(
    { scope: 'default', meterId: null },
    { scope: 'default', meterId: null, parameters: DEFAULT_PARAMETERS },
    { upsert: true, new: true }
  );
  console.log('✅ Default parameter map ready (voltage, current, activePower, energy)');
}

async function postSampleData() {
  for (const meter of DEMO_METERS) {
    const simDevice = {
      deviceId: meter.deviceId,
      machineProfile: meter.machineProfile || 'warehouse',
      state: 'working',
      jitter: true,
      energyBaseReading: meter.energyBaseReading,
    };
    const { payload, readings } = buildEnergyMeterPayload(simDevice, { advanceReading: true });
    const res = await fetch(`${BASE_URL}/api/energy-meter/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    console.log(
      `📡 POST ${meter.deviceId} → ${res.status}`,
      readings ? `(${readings.voltage}V, ${readings.current}A, ${readings.activePower}kW, ${readings.energy}kWh)` : '',
      data.message || data
    );
  }
}

async function main() {
  await connectDB();
  await seedDevices();
  await postSampleData();

  if (LOOP) {
    console.log('🔄 Loop mode: posting every 3 minutes. Ctrl+C to stop.');
    setInterval(postSampleData, 3 * 60 * 1000);
  } else {
    await mongoose.disconnect();
    console.log('Done. Use --loop for periodic demo posts.');
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
