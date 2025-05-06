require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');           // ✅ Use external DB connection
const Device = require('./models/Device');         // ✅ Import model

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// ✅ Connect to MongoDB
connectDB();

// API: Get device list
app.get('/api/devices', async (req, res) => {
  try {
    const devices = await Device.find();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch devices" });
  }
});

// API: Get dashboard stats
app.get('/api/dashboard', async (req, res) => {
  try {
    const devices = await Device.find();
    const activeDevices = devices.filter(d => d.subscription === "Active").length;
    const inactiveDevices = devices.filter(d => d.subscription === "Inactive").length;
    const alarms = 0; // Placeholder

    res.json({ activeDevices, inactiveDevices, alarms });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
});

// API: Seed sample devices
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

// API: Add a new device
app.post('/api/devices', async (req, res) => {
  try {
    const newDevice = new Device(req.body);
    await newDevice.save();
    res.status(201).json(newDevice);
  } catch (err) {
    res.status(400).json({ message: "Failed to add device" });
  }
});

// API: Delete a device by ID
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
