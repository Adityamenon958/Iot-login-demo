require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./backend/db');
const Device = require('./backend/models/Device');
const User = require('./backend/models/User');
const LevelSensor = require('./backend/models/LevelSensor');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 8080;
app.use(cors());
app.use(express.json());

// DB connect
connectDB();




// For Old Devices 
// app.get('/api/devices', async (req, res) => {
//   try {
//     const devices = await Device.find();
//     res.json(devices);
//   } catch (err) {
//     res.status(500).json({ message: "Failed to fetch devices" });
//   }
// });



// app.get('/api/seed', async (req, res) => {
//   try {
//     // await Device.insertMany([
//     //   { name: "Sensor Alpha", location: "Mumbai", subscription: "Active" },
//     //   { name: "Sensor Beta", location: "Delhi", subscription: "Inactive" },
//     //   { name: "Thermal Scanner", location: "Bangalore", subscription: "Active" },
//     //   { name: "Pressure Monitor", location: "Chennai", subscription: "Inactive" },
//     //   { name: "Humidity Tracker", location: "Hyderabad", subscription: "Active" },

//     await User.create({ email: "admin2@example.com", password: "admin123", role: "user" });
    
    
//     res.send("Database seeded ✅");
//   } catch (err) {
//     console.error("🔥 Seeding error:", err);
//     res.status(500).json({ message: "Seeding failed ❌" , error: err.message  });
//   }
// });

// app.post('/api/devices', async (req, res) => {
//   try {
//     const newDevice = new Device(req.body);
//     await newDevice.save();
//     res.status(201).json(newDevice);
//   } catch (err) {
//     res.status(400).json({ message: "Failed to add device" });
//   }
// });

// For Superadmin
app.get('/api/companies/count', async (req, res) => {
  try {
    const companies = await User.distinct("companyName");
    res.json({ totalCompanies: companies.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to count companies" });
  }
});

// Get total users count
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

// For Admin
// 🔹 Count users for a given company
app.get('/api/users/count/by-company', async (req, res) => {
  const { companyName } = req.query;
  try {
    const count = await User.countDocuments({ companyName });
    res.json({ totalUsersByCompany: count });
  } catch (err) {
    res.status(500).json({ error: "Failed to count users by company" });
  }
});

// 🔹 Count devices for a given company
app.get('/api/devices/count/by-company', async (req, res) => {
  const { companyName } = req.query;
  try {
    const count = await Device.countDocuments({ companyName });
    res.json({ totalDevicesByCompany: count });
  } catch (err) {
    res.status(500).json({ error: "Failed to count devices by company" });
  }
});

// app.get('/api/dashboard', async (req, res) => {
//   try {
//     const devices = await Device.find();
//     const activeDevices = devices.filter(d => d.subscription === "Active").length;
//     const inactiveDevices = devices.filter(d => d.subscription === "Inactive").length;
//     const alarms = 0;
//     res.json({ activeDevices, inactiveDevices, alarms });
//   } catch (err) {
//     res.status(500).json({ message: "Failed to fetch dashboard stats" });
//   }
// });

// For Master Devices Table
app.post('/api/devices', async (req, res) => {
  try {
    const { companyName, uid, deviceId, deviceType, location, frequency } = req.body;

    // Optional basic validation
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
  const companyName = req.query.companyName; // get it from URL query
  // console.log('Received company name in query:', companyName);
  try {
    let query = {};
    if (companyName) {
      query.companyName = companyName;
    }

    const devices = await Device.find(query);
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ message: 'Failed to fetch devices' });
  }
});


app.get('/api/users', async (req, res) => {
  const companyName = req.query.companyName; // get from frontend query

  try {
    let query = {};
    if (companyName) {
      query.companyName = companyName;
    }

    const users = await User.find(query);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});


// POST sensor data from IoT device
app.post('/api/levelsensor', async (req, res) => {
  console.log("Received sensor POST data:", req.body);  
  try {
    // Destructure uid from req.body as well
    const { D, address, data, "Vehicle no": vehicleNo, uid } = req.body;

    // Validate required fields including uid
    if (!D || !address || !data || !vehicleNo || !uid) {
      return res.status(400).json({ message: "Missing required fields ❌" });
    }

    const newSensorData = new LevelSensor({
      D,
      address,
      data,
      vehicleNo,
      uid,    // Save uid here
    });

    await newSensorData.save();

    res.status(201).json({ message: "Sensor data saved successfully ✅" });
  } catch (err) {
    console.error("Error saving sensor data:", err);
    res.status(500).json({ message: "Internal Server Error 💥" });
  }
});

// GET all sensor data (for frontend table)
app.get('/api/levelsensor', async (req, res) => {
  try {
    const allData = await LevelSensor.find().sort({ D: -1 }); // newest first
    res.json(allData);
  } catch (err) {
    console.error("Error fetching sensor data:", err);
    res.status(500).json({ message: "Internal Server Error 💥" });
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
    if (!deleted) {
      return res.status(404).json({ message: 'Device not found' });
    }
    res.json({ message: 'Device deleted successfully' });
  } catch (err) {
    console.error("❌ Delete failed:", err.message);
    res.status(500).json({ message: 'Server error' });
  }
});



app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials ❌" });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "supersecretkey",  // Use env in prod
      { expiresIn: '1h' }
    );

    res.json({
      message: "Login successful ✅",
      token,
      role: user.role,
      companyName: user.companyName,
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Login failed ❌" });
  }
});




// ✅ Serve frontend from frontend/dist
app.use(express.static(path.join(__dirname, "frontend/dist")));


app.get('*', (req, res) => {
  // If the request is for an API route and didn't match anything, send 404 JSON
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'API route not found' });
  }

  // Otherwise, serve React app
  res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
