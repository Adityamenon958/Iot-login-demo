require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./backend/db');
const Device = require('./backend/models/Device');
const User = require('./backend/models/User');
const LevelSensor = require('./backend/models/LevelSensor');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser'); // ✅ added cookie-parser

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser()); // ✅ use cookie-parser

// DB connect
connectDB();

app.get('/api/auth/userinfo', (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecretkey");
    User.findById(decoded.id).then(user => {
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({ role: user.role, companyName: user.companyName });
    });
  } catch (err) {
    console.error("Auth error:", err.message);
    res.status(403).json({ message: "Forbidden" });
  }
});

// Superadmin Routes
app.get('/api/companies/count', async (req, res) => {
  try {
    const companies = await User.distinct("companyName");
    res.json({ totalCompanies: companies.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to count companies" });
  }
});

app.get('/api/users/count', async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ totalUsers: count });
  } catch (err) {
    res.status(500).json({ error: "Failed to count users" });
  }
});

app.get('/api/devices/count', async (req, res) => {
  try {
    const totalDevices = await Device.countDocuments();
    res.json({ totalDevices });
  } catch (err) {
    res.status(500).json({ message: "Error counting devices ❌" });
  }
});

// Admin Routes
app.get('/api/users/count/by-company', async (req, res) => {
  const { companyName } = req.query;
  try {
    const count = await User.countDocuments({ companyName });
    res.json({ totalUsersByCompany: count });
  } catch (err) {
    res.status(500).json({ error: "Failed to count users by company" });
  }
});

app.get('/api/devices/count/by-company', async (req, res) => {
  const { companyName } = req.query;
  try {
    const count = await Device.countDocuments({ companyName });
    res.json({ totalDevicesByCompany: count });
  } catch (err) {
    res.status(500).json({ error: "Failed to count devices by company" });
  }
});

// Devices
app.post('/api/devices', async (req, res) => {
  try {
    const { companyName, uid, deviceId, deviceType, location, frequency } = req.body;

    if (!companyName || !uid || !deviceId || !deviceType || !location || !frequency) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const newDevice = new Device({
      companyName,
      uid,
      deviceId,
      deviceType,
      location,
      frequency,
    });

    await newDevice.save();
    res.status(201).json({ message: 'Device added successfully' });
  } catch (error) {
    console.error('Error adding device:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/devices', async (req, res) => {
  const companyName = req.query.companyName;
  try {
    const query = companyName ? { companyName } : {};
    const devices = await Device.find(query);
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ message: 'Failed to fetch devices' });
  }
});

// Users
app.get('/api/users', async (req, res) => {
  const companyName = req.query.companyName;
  try {
    const query = companyName ? { companyName } : {};
    const users = await User.find(query);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

app.post('/api/users', async (req, res) => {
  const { email, password, role, name, companyName, contactInfo } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const newUser = new User({ email, password, role, name, companyName, contactInfo });
    await newUser.save();

    res.status(201).json({ message: "User created successfully ✅" });
  } catch (err) {
    console.error("Add user error:", err.message);
    res.status(500).json({ message: "Server error ❌" });
  }
});

app.delete('/api/devices/:id', async (req, res) => {
  try {
    const deleted = await Device.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Device not found' });
    res.json({ message: 'Device deleted successfully' });
  } catch (err) {
    console.error("❌ Delete failed:", err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Level Sensor Data
app.post('/api/levelsensor', async (req, res) => {
  console.log("📡 Incoming sensor data:", req.body);
  try {
    const { D, UID, LEVEL, TS, vehicleNo, address, data } = req.body;

    const newSensorData = new LevelSensor({
      D: D || null,
      uid: UID || null,
      level: LEVEL !== undefined ? LEVEL : null,
      ts: TS || null,
      vehicleNo: vehicleNo || null,
      address: address !== undefined ? address : null,
      data: Array.isArray(data) ? data : (data !== undefined ? [data] : null)
    });

    await newSensorData.save();
    res.status(201).json({ message: "Sensor data saved successfully ✅" });
  } catch (err) {
    console.error("❌ Sensor save error:", err);
    res.status(500).json({ message: "Internal Server Error 💥" });
  }
});

app.get('/api/levelsensor', async (req, res) => {
  try {
    const allData = await LevelSensor.find().sort({ D: -1 });
    res.json(allData);
  } catch (err) {
    console.error("Error fetching sensor data:", err);
    res.status(500).json({ message: "Internal Server Error 💥" });
  }
});

// ✅ Modified Login API — sets token as secure HTTP-only cookie
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials ❌" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "supersecretkey",
      { expiresIn: '1h' }
    );

    res
      .cookie('token', token, {
        httpOnly: true,
        secure: true, // ⚠️ must use HTTPS
        sameSite: 'Strict',
        maxAge: 60 * 60 * 1000, // 1 hour
      })
      .json({
        message: "Login successful ✅",
        role: user.role,
        companyName: user.companyName,
      });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Login failed ❌" });
  }
});

// Serve frontend
app.use(express.static(path.join(__dirname, "frontend/dist")));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
