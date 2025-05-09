require('dotenv').config({ path: './backend/.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./backend/db');
const Device = require('./backend/models/Device');

const app = express();
const PORT = process.env.PORT || 8080;
app.use(cors());
app.use(express.json());

// DB connect
connectDB();



// API routes
app.get('/api/devices', async (req, res) => {
  try {
    const devices = await Device.find();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch devices" });
  }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const devices = await Device.find();
    const activeDevices = devices.filter(d => d.subscription === "Active").length;
    const inactiveDevices = devices.filter(d => d.subscription === "Inactive").length;
    const alarms = 0;
    res.json({ activeDevices, inactiveDevices, alarms });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
});

app.get('/api/seed', async (req, res) => {
  try {
    await Device.insertMany([
      { name: "Sensor Alpha", location: "Mumbai", subscription: "Active" },
      { name: "Sensor Beta", location: "Delhi", subscription: "Inactive" },
      { name: "Thermal Scanner", location: "Bangalore", subscription: "Active" },
      { name: "Pressure Monitor", location: "Chennai", subscription: "Inactive" },
      { name: "Humidity Tracker", location: "Hyderabad", subscription: "Active" },
    ]);
    res.send("Database seeded ✅");
  } catch (err) {
    res.status(500).json({ message: "Seeding failed ❌" });
  }
});

app.post('/api/devices', async (req, res) => {
  try {
    const newDevice = new Device(req.body);
    await newDevice.save();
    res.status(201).json(newDevice);
  } catch (err) {
    res.status(400).json({ message: "Failed to add device" });
  }
});

app.delete('/api/devices/:id', async (req, res) => {
  try {
    const deleted = await Device.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Device not found' });
    }
    res.json({ message: 'Device deleted successfully' });
  } catch (err) {
    console.error("❌ Delete failed:", err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Serve frontend from frontend/dist
app.use(express.static(path.join(__dirname, "frontend/dist")));


app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
