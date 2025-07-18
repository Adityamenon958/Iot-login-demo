require('dotenv').config();
console.log('SMTP vars:', process.env.GMAIL_USER, process.env.GMAIL_PASS?.length);

const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./backend/db');
const Device = require('./backend/models/Device');
const User = require('./backend/models/User');
const LevelSensor = require('./backend/models/LevelSensor');
const CraneLog = require("./backend/models/CraneLog"); // adjust path if needed
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const Razorpay = require('razorpay');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const Alarm = require("./backend/models/Alarm"); 
const app = express();
const PORT = process.env.PORT || 8080;
/**  In-memory latch: { uid: true | false }  */
const alarmLatch = Object.create(null);
const sendEmail = require("./backend/utils/sendEmail");
const { alarmEmail } = require("./backend/utils/emailTemplates");

const isProd = process.env.NODE_ENV === 'production';


// ✅ Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());



// ✅ JWT Authentication Middleware (fixed)
function authenticateToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecretkey");
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Token verification error:", err.message);
    return res.status(403).json({ message: "Forbidden" });
  }
}

// ✅ Connect MongoDB
connectDB();

// ✅ Razorpay Instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ✅ Razorpay Subscription Route
app.post('/api/payment/subscription', async (req, res) => {
  const { planType } = req.body;

  // map plan types to Razorpay plan_ids
  const planMap = {
    standard: 'plan_QahYd7AXNyAmW0', // ₹99 plan
    premium: 'plan_QahYvtyIlkGGuA',  // ₹199 plan
  };

  const plan_id = planMap[planType];

  if (!plan_id) {
    return res.status(400).json({ message: 'Invalid plan type' });
  }

  try {
    const subscription = await razorpay.subscriptions.create({
      plan_id: plan_id,
      customer_notify: 1,
      total_count: 12, // optional: 12 months max billing
    });

    res.json(subscription);
  } catch (err) {
    console.error("Error creating subscription:", err);
    res.status(500).json({ message: "Subscription creation failed" });
  }
});

// POST /api/auth/update-subscription
app.post('/api/auth/update-subscription', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id); // `req.user` comes from JWT
    if (!user) return res.status(404).json({ message: "User not found" });

    // Re-issue updated JWT
    const tokenPayload = {
      id: user._id,
      role: user.role,
      companyName: user.companyName,
      subscriptionStatus: user.subscriptionStatus,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res
      .cookie('token', token, {
        httpOnly: true,
        // secure: true,
        secure   : isProd,          // ← localhost will now get a non-secure cookie
        // sameSite: 'None',
        sameSite : isProd ? 'None' : 'Lax',   // 'None' + secure for prod, 'Lax' for dev
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({ message: "Subscription info updated" });
  } catch (err) {
    console.error("❌ Update subscription error:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ Check Subscription Status
app.get('/api/subscription/status', async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecretkey");
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // If no subscription ID stored, it's inactive
    if (!user.subscriptionId) return res.json({ active: false });

    // 🔄 Call Razorpay to check real-time status
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const razorSub = await razorpay.subscriptions.fetch(user.subscriptionId);

    // If subscription is cancelled or completed
    if (razorSub.status !== 'active') {
      user.subscriptionStatus = 'inactive';
      await user.save();
      return res.json({ active: false });
    }

    // ✅ Also double check expiry (1 month logic stays)
    const now = new Date();
    const oneMonthLater = new Date(user.subscriptionStart);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    if (now > oneMonthLater) {
      user.subscriptionStatus = 'inactive';
      await user.save();
      return res.json({ active: false });
    }

    return res.json({ active: true });
  } catch (err) {
    console.error("Subscription check error:", err.message);
    res.status(500).json({ message: "Failed to check subscription" });
  }
});

app.get('/api/test-email', async (req, res) => {
  try {
    await sendEmail({
      to: process.env.GMAIL_USER,          // send to yourself for the test
      subject: 'Test mail from IoT app',
      html: '<p>If you are reading this, SMTP works 🎉</p>'
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('✉️  TEST MAIL FAILED:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});


// ✅ Mark Subscription Active After Payment
app.post('/api/payment/activate-subscription', authenticateToken, async (req, res) => {

  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "supersecretkey");
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Update DB fields
    user.subscriptionStatus = "active";
    user.subscriptionStart = new Date();
    user.subscriptionId = req.body.subscriptionId || null;
    await user.save();

    // ✅ Re-issue JWT with updated subscriptionStatus
    const jwtSecret = process.env.JWT_SECRET || 'supersecretkey';

const updatedToken = jwt.sign({
  id: user._id,
  role: user.role,
  companyName: user.companyName,
  subscriptionStatus: user.subscriptionStatus,
}, jwtSecret, { expiresIn: '7d' });


    console.log("🔐 Activating subscription for user ID:", user._id);

res
  .cookie('token', updatedToken, {
    httpOnly: true,
    // secure: true,
    secure   : isProd,
    // sameSite: 'None',
    sameSite : isProd ? 'None' : 'Lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
  .json({ message: "Subscription activated and token updated ✅" });


  } catch (err) {
    console.error("❌ Activation error:", err.message);
    res.status(500).json({ message: "Subscription activation failed" });
  }
});




// ✅ User Info from Token (via Cookie)
app.get('/api/auth/userinfo', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 🔄 Live check with Razorpay if subscriptionId exists
        if (user.subscriptionId) {
      try {
        const razorSub = await razorpay.subscriptions.fetch(user.subscriptionId);

        const now          = new Date();
        const oneMonthLater= new Date(user.subscriptionStart);
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

        if (
          razorSub.status !== 'active' ||
          now > oneMonthLater
        ) {
          user.subscriptionStatus = 'inactive';
          await user.save();
        }
      } catch (err) {
        console.warn(
          "⚠️ Razorpay check failed – keeping existing subscriptionStatus:",
          err.message
        );
        // Network/auth error → do NOT flip the status, just log and proceed
      }
    }


    res.json({
      role: user.role,
      companyName: user.companyName,
      subscriptionStatus: user.subscriptionStatus,
    });
  } catch (err) {
    console.error("Auth error:", err.message);
    res.status(403).json({ message: "Forbidden" });
  }
});



// ✅ Superadmin Routes
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

// ✅ Admin Routes
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

// ✅ Device Routes
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

// ✅ User Routes
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

// ✅ API endpoint to receive crane log data
app.post("/api/crane/log", async (req, res) => {
  try {
    // Validate required fields
    const {
      DeviceID, Timestamp, Date, Time,
      Longitude, Latitude, DigitalInput1, DigitalInput2
    } = req.body;

    if (
      !DeviceID || !Timestamp || !Date || !Time ||
      !Longitude || !Latitude || !DigitalInput1 || !DigitalInput2
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Save to DB
    const log = new CraneLog({
      DeviceID, Timestamp, Date, Time,
      Longitude, Latitude, DigitalInput1, DigitalInput2
    });
    await log.save();

    res.status(201).json({ message: "Crane log saved successfully" });
  } catch (err) {
    console.error("Crane log save error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ GET: Fetch unique crane devices
app.get("/api/crane/devices", authenticateToken, async (req, res) => {
  try {
    // Get unique DeviceIDs from crane logs
    const devices = await CraneLog.distinct("DeviceID");
    
    // Create device objects with additional info
    const deviceList = await Promise.all(
      devices.map(async (deviceId) => {
        const latestLog = await CraneLog.findOne({ DeviceID: deviceId })
          .sort({ createdAt: -1 })
          .lean();
        
        return {
          DeviceID: deviceId,
          location: latestLog ? `${latestLog.Latitude}, ${latestLog.Longitude}` : "Unknown",
          lastSeen: latestLog ? latestLog.Timestamp : "Never"
        };
      })
    );

    res.json(deviceList);
  } catch (err) {
    console.error("Crane devices fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ GET: Fetch crane logs with pagination
app.get("/api/crane/logs", authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;
    const deviceId = req.query.deviceId;

    const filter = {};
    if (deviceId) filter.DeviceID = deviceId;

    const [logs, total] = await Promise.all([
      CraneLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CraneLog.countDocuments(filter)
    ]);

    res.json({ logs, total, page, limit });
  } catch (err) {
    console.error("Crane logs fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ GET: Fetch current crane status
app.get("/api/crane/status", authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.query;
    
    if (!deviceId) {
      return res.status(400).json({ error: "DeviceID is required" });
    }

    // Get latest log for this device
    const latestLog = await CraneLog.findOne({ DeviceID: deviceId })
      .sort({ createdAt: -1 })
      .lean();

    if (!latestLog) {
      return res.status(404).json({ error: "No data found for this device" });
    }

    // Determine status based on digital inputs
    const isOperating = latestLog.DigitalInput1 === "1";
    const isDown = latestLog.DigitalInput2 === "1";

    let status = "Unknown";
    let statusColor = "secondary";

    if (isDown) {
      status = "Under Maintenance";
      statusColor = "warning";
    } else if (isOperating) {
      status = "Operating";
      statusColor = "success";
    } else {
      status = "Idle";
      statusColor = "secondary";
    }

    res.json({
      deviceId,
      status,
      statusColor,
      isOperating,
      isDown,
      lastUpdate: latestLog.Timestamp,
      location: `${latestLog.Latitude}, ${latestLog.Longitude}`,
      digitalInput1: latestLog.DigitalInput1,
      digitalInput2: latestLog.DigitalInput2
    });
  } catch (err) {
    console.error("Crane status fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ GET: Fetch crane activity summary (operating hours)
app.get("/api/crane/activity", authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.query;
    
    if (!deviceId) {
      return res.status(400).json({ error: "DeviceID is required" });
    }

    // Get logs for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logs = await CraneLog.find({
      DeviceID: deviceId,
      createdAt: { $gte: thirtyDaysAgo }
    })
    .sort({ createdAt: 1 })
    .lean();

    if (logs.length === 0) {
      return res.json({
        deviceId,
        todayHours: 0,
        weekHours: 0,
        monthHours: 0,
        recentActivity: []
      });
    }

    // Calculate operating hours
    let totalOperatingMinutes = 0;
    let todayOperatingMinutes = 0;
    let weekOperatingMinutes = 0;
    const operatingSessions = []; // NEW: Array to store complete operating sessions

    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    let lastOperatingState = null;
    let lastOperatingTime = null;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const isOperating = log.DigitalInput1 === "1";
      
      // ✅ FIX: Use actual crane timestamp instead of database createdAt
      let logTime;
      try {
        // Parse crane timestamp: "07/01/2025 08:00:00"
        const [datePart, timePart] = log.Timestamp.split(' ');
        const [month, day, year] = datePart.split('/').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        logTime = new Date(year, month - 1, day, hour, minute, second);
      } catch (err) {
        console.error("Error parsing timestamp:", log.Timestamp);
        logTime = new Date(log.createdAt); // Fallback to createdAt
      }

      // ✅ NEW: Track complete operating sessions (Start → Stop)
      if (lastOperatingState === true && !isOperating && lastOperatingTime) {
        // Crane just stopped - create a complete session
        const minutesOperated = (logTime - lastOperatingTime) / (1000 * 60);
        const hoursOperated = Math.round((minutesOperated / 60) * 10) / 10;
        
        operatingSessions.push({
          startTime: lastOperatingTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          stopTime: logTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          date: lastOperatingTime.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
          totalHours: hoursOperated,
          minutesOperated: minutesOperated
        });

        // Add to totals
        totalOperatingMinutes += minutesOperated;

        // Today's hours (compare dates properly)
        const logDate = logTime.toDateString();
        const todayDate = today.toDateString();
        if (logDate === todayDate) {
          todayOperatingMinutes += minutesOperated;
        }

        // Week's hours - FIX: Check if the START time was within the week
        if (lastOperatingTime >= weekAgo) {
          weekOperatingMinutes += minutesOperated;
        }
      }

      // Update state tracking
      if (isOperating && lastOperatingState !== true) {
        // Crane just started - record start time
        lastOperatingTime = logTime;
      }
      
      lastOperatingState = isOperating;
    }

    // ✅ NEW: Handle case where crane is still operating (no stop event yet)
    if (lastOperatingState === true && lastOperatingTime) {
      const now = new Date();
      const minutesOperated = (now - lastOperatingTime) / (1000 * 60);
      
      // ✅ DEBUG: Log the calculation
      console.log(`\n🔍 ONGOING SESSION DEBUG:`);
      console.log(`Start time: ${lastOperatingTime}`);
      console.log(`Current time: ${now}`);
      console.log(`Minutes operated: ${minutesOperated}`);
      console.log(`Is future date: ${lastOperatingTime > now}`);
      
      // ✅ FIX: Handle future dates by using a small default duration
      let actualMinutesOperated = minutesOperated;
      if (minutesOperated <= 0) {
        // For future dates or same time, assume 1 minute of operation
        actualMinutesOperated = 1;
        console.log(`⚠️ Future/same timestamp detected. Using 1 minute as default.`);
      }
      
      // Only add if it's reasonable (less than 24 hours)
      if (actualMinutesOperated < 24 * 60) {
        const hoursOperated = Math.round((actualMinutesOperated / 60) * 10) / 10;
        
        // Add ongoing session
        operatingSessions.push({
          startTime: lastOperatingTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          stopTime: "Running...", // Still operating
          date: lastOperatingTime.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
          totalHours: hoursOperated,
          minutesOperated: actualMinutesOperated
        });

        totalOperatingMinutes += actualMinutesOperated;
        
        // For today's calculation, use actual date comparison
        const startDate = lastOperatingTime.toDateString();
        const todayDate = now.toDateString();
        console.log(`Start date: ${startDate}, Today: ${todayDate}, Same day: ${startDate === todayDate}`);
        
        if (startDate === todayDate) {
          todayOperatingMinutes += actualMinutesOperated;
        }
        
        if (lastOperatingTime >= weekAgo) {
          weekOperatingMinutes += actualMinutesOperated;
        }
      } else if (minutesOperated <= 0) {
        console.log(`⚠️ WARNING: Future timestamp detected. Skipping ongoing session calculation.`);
      }
    }

    // Convert minutes to hours
    const todayHours = Math.round((todayOperatingMinutes / 60) * 10) / 10;
    const weekHours = Math.round((weekOperatingMinutes / 60) * 10) / 10;
    const monthHours = Math.round((totalOperatingMinutes / 60) * 10) / 10;

    res.json({
      deviceId,
      todayHours,
      weekHours,
      monthHours,
      operatingSessions: operatingSessions.slice(-10).reverse() // Last 10 sessions, newest first
    });
  } catch (err) {
    console.error("Crane activity fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ NEW: Single API endpoint for ALL crane data (simplified approach)
app.get("/api/crane/dashboard/:deviceId", authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    if (!deviceId) {
      return res.status(400).json({ error: "DeviceID is required" });
    }

    // Get all devices first
    const devices = await CraneLog.distinct("DeviceID");
    const deviceList = await Promise.all(
      devices.map(async (id) => {
        const latestLog = await CraneLog.findOne({ DeviceID: id })
          .sort({ createdAt: -1 })
          .lean();
        
        return {
          DeviceID: id,
          location: latestLog ? `${latestLog.Latitude}, ${latestLog.Longitude}` : "Unknown",
          lastSeen: latestLog ? latestLog.Timestamp : "Never"
        };
      })
    );

    // Get latest status for selected device
    const latestLog = await CraneLog.findOne({ DeviceID: deviceId })
      .sort({ createdAt: -1 })
      .lean();

    if (!latestLog) {
      return res.status(404).json({ error: "No data found for this device" });
    }

    // Determine status
    const isOperating = latestLog.DigitalInput1 === "1";
    const isDown = latestLog.DigitalInput2 === "1";
    let status = "Unknown";
    let statusColor = "secondary";

    if (isDown) {
      status = "Under Maintenance";
      statusColor = "warning";
    } else if (isOperating) {
      status = "Operating";
      statusColor = "success";
    } else {
      status = "Idle";
      statusColor = "secondary";
    }

    // Get activity data (reuse the same logic from /activity endpoint)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const logs = await CraneLog.find({
      DeviceID: deviceId,
      createdAt: { $gte: thirtyDaysAgo }
    })
    .sort({ createdAt: 1 })
    .lean();

    let totalOperatingMinutes = 0;
    let todayOperatingMinutes = 0;
    let weekOperatingMinutes = 0;
    const operatingSessions = []; // NEW: Array to store complete operating sessions

    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    let lastOperatingState = null;
    let lastOperatingTime = null;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const isOp = log.DigitalInput1 === "1";
      
      let logTime;
      try {
        const [datePart, timePart] = log.Timestamp.split(' ');
        const [month, day, year] = datePart.split('/').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        logTime = new Date(year, month - 1, day, hour, minute, second);
      } catch (err) {
        logTime = new Date(log.createdAt);
      }

      // NEW: Track complete operating sessions (Start → Stop)
      if (lastOperatingState === true && !isOp && lastOperatingTime) {
        // Crane just stopped - create a complete session
        const minutesOperated = (logTime - lastOperatingTime) / (1000 * 60);
        const hoursOperated = Math.round((minutesOperated / 60) * 10) / 10;
        
        operatingSessions.push({
          startTime: lastOperatingTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          stopTime: logTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          date: lastOperatingTime.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
          totalHours: hoursOperated,
          minutesOperated: minutesOperated
        });

        // Add to totals
        totalOperatingMinutes += minutesOperated;

        if (logTime.toDateString() === today.toDateString()) {
          todayOperatingMinutes += minutesOperated;
        }

        // FIX: Check if the START time was within the week
        if (lastOperatingTime >= weekAgo) {
          weekOperatingMinutes += minutesOperated;
        }
      }

      if (isOp && lastOperatingState !== true) {
        lastOperatingTime = logTime;
      }
      
      lastOperatingState = isOp;
    }

    // NEW: Handle case where crane is still operating (no stop event yet)
    if (lastOperatingState === true && lastOperatingTime) {
      const now = new Date();
      const minutesOperated = (now - lastOperatingTime) / (1000 * 60);
      
      console.log(`\n🔍 DASHBOARD ONGOING SESSION DEBUG:`);
      console.log(`Start time: ${lastOperatingTime}`);
      console.log(`Current time: ${now}`);
      console.log(`Minutes operated: ${minutesOperated}`);
      console.log(`Is future date: ${lastOperatingTime > now}`);
      
      // FIX: Handle future dates by using a small default duration
      let actualMinutesOperated = minutesOperated;
      if (minutesOperated <= 0) {
        // For future dates or same time, assume 1 minute of operation
        actualMinutesOperated = 1;
        console.log(`⚠️ Future/same timestamp detected. Using 1 minute as default.`);
      }
      
      // Only add if it's reasonable (less than 24 hours)
      if (actualMinutesOperated < 24 * 60) {
        const hoursOperated = Math.round((actualMinutesOperated / 60) * 10) / 10;
        
        // Add ongoing session
        operatingSessions.push({
          startTime: lastOperatingTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          stopTime: "Running...", // Still operating
          date: lastOperatingTime.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
          totalHours: hoursOperated,
          minutesOperated: actualMinutesOperated
        });

        totalOperatingMinutes += actualMinutesOperated;
        
        // For today's calculation, use actual date comparison
        const startDate = lastOperatingTime.toDateString();
        const todayDate = now.toDateString();
        console.log(`Start date: ${startDate}, Today: ${todayDate}, Same day: ${startDate === todayDate}`);
        
        if (startDate === todayDate) {
          todayOperatingMinutes += actualMinutesOperated;
        }
        
        if (lastOperatingTime >= weekAgo) {
          weekOperatingMinutes += actualMinutesOperated;
        }
      }
    }

    const todayHours = Math.round((todayOperatingMinutes / 60) * 10) / 10;
    const weekHours = Math.round((weekOperatingMinutes / 60) * 10) / 10;
    const monthHours = Math.round((totalOperatingMinutes / 60) * 10) / 10;

    // Return ALL data in one response
    res.json({
      devices: deviceList,
      selectedDevice: {
        deviceId,
        status,
        statusColor,
        isOperating,
        isDown,
        lastUpdate: latestLog.Timestamp,
        location: `${latestLog.Latitude}, ${latestLog.Longitude}`,
        digitalInput1: latestLog.DigitalInput1,
        digitalInput2: latestLog.DigitalInput2
      },
      activity: {
        todayHours,
        weekHours,
        monthHours,
        operatingSessions: operatingSessions.slice(-10).reverse() // Last 10 sessions, newest first
      }
    });
  } catch (err) {
    console.error("Crane dashboard fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ─── get crane chart data ─── */
app.get('/api/crane/chart', authenticateToken, async (req, res) => {
  try {
    const { deviceId, period = '24hr' } = req.query;
    const { companyName } = req.user;

    if (!deviceId) {
      return res.status(400).json({ message: 'Device ID is required' });
    }

    // Get logs based on period
    let startDate;
    const now = new Date();
    
    switch (period) {
      case '24hr':
        startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        break;
      case 'yearly':
        startDate = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
        break;
      default:
        startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    }

    const logs = await CraneLog.find({
      DeviceID: deviceId,
      createdAt: { $gte: startDate }
    }).sort({ Timestamp: 1 });

    if (logs.length === 0) {
      return res.json({
        labels: [],
        data: [],
        period: period
      });
    }

    // Calculate operating sessions (reuse the same logic)
    const operatingSessions = [];
    let lastOperatingState = null;
    let lastOperatingTime = null;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const isOperating = log.DigitalInput1 === '1';
      
      let logTime;
      try {
        const [datePart, timePart] = log.Timestamp.split(' ');
        const [month, day, year] = datePart.split('/').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        logTime = new Date(year, month - 1, day, hour, minute, second);
      } catch (err) {
        logTime = new Date(log.createdAt);
      }

      if (lastOperatingState === true && !isOperating && lastOperatingTime) {
        // Crane just stopped - create a complete session
        const minutesOperated = (logTime - lastOperatingTime) / (1000 * 60);
        const hoursOperated = Math.round((minutesOperated / 60) * 10) / 10;
        
        operatingSessions.push({
          startTime: lastOperatingTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          stopTime: logTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          date: lastOperatingTime.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
          totalHours: hoursOperated,
          startTimestamp: lastOperatingTime
        });
      }

      if (isOperating && lastOperatingState !== true) {
        lastOperatingTime = logTime;
      }
      
      lastOperatingState = isOperating;
    }

    // Handle ongoing session
    if (lastOperatingState === true && lastOperatingTime) {
      const now = new Date();
      let minutesOperated = (now - lastOperatingTime) / (1000 * 60);
      
      if (minutesOperated <= 0) {
        minutesOperated = 1; // Default for future dates
      }
      
      if (minutesOperated < 24 * 60) {
        const hoursOperated = Math.round((minutesOperated / 60) * 10) / 10;
        
        operatingSessions.push({
          startTime: lastOperatingTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          stopTime: "Running...",
          date: lastOperatingTime.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
          totalHours: hoursOperated,
          startTimestamp: lastOperatingTime
        });
      }
    }

    // Group data by time period
    const chartData = groupDataByPeriod(operatingSessions, period);

    res.json({
      labels: chartData.labels,
      data: chartData.data,
      period: period
    });

  } catch (error) {
    console.error('Crane chart error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/* ─── group data by period helper ─── */
function groupDataByPeriod(sessions, period) {
  const now = new Date();
  const data = [];
  const labels = [];

  switch (period) {
    case '24hr':
      // Group by hour for last 24 hours
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getTime() - (i * 60 * 60 * 1000));
        const hourStr = hour.getHours().toString().padStart(2, '0') + ':00';
        labels.push(hourStr);
        
        const hoursInThisHour = sessions
          .filter(session => {
            const sessionStart = session.startTimestamp || new Date(session.date);
            return sessionStart.getHours() === hour.getHours() && 
                   sessionStart.toDateString() === hour.toDateString();
          })
          .reduce((sum, session) => sum + session.totalHours, 0);
        
        data.push(Math.round(hoursInThisHour * 10) / 10);
      }
      break;

    case 'weekly':
      // Group by day for last 7 days
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
        const dayStr = day.toLocaleDateString('en-US', { weekday: 'short' });
        labels.push(dayStr);
        
        const hoursInThisDay = sessions
          .filter(session => {
            const sessionStart = session.startTimestamp || new Date(session.date);
            return sessionStart.toDateString() === day.toDateString();
          })
          .reduce((sum, session) => sum + session.totalHours, 0);
        
        data.push(Math.round(hoursInThisDay * 10) / 10);
      }
      break;

    case 'monthly':
      // Group by day for last 30 days
      for (let i = 29; i >= 0; i--) {
        const day = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
        const dayStr = day.getDate().toString();
        labels.push(dayStr);
        
        const hoursInThisDay = sessions
          .filter(session => {
            const sessionStart = session.startTimestamp || new Date(session.date);
            return sessionStart.toDateString() === day.toDateString();
          })
          .reduce((sum, session) => sum + session.totalHours, 0);
        
        data.push(Math.round(hoursInThisDay * 10) / 10);
      }
      break;

    case 'yearly':
      // Group by month for last 12 months
      for (let i = 11; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = month.toLocaleDateString('en-US', { month: 'short' });
        labels.push(monthStr);
        
        const hoursInThisMonth = sessions
          .filter(session => {
            const sessionStart = session.startTimestamp || new Date(session.date);
            return sessionStart.getMonth() === month.getMonth() && 
                   sessionStart.getFullYear() === month.getFullYear();
          })
          .reduce((sum, session) => sum + session.totalHours, 0);
        
        data.push(Math.round(hoursInThisMonth * 10) / 10);
      }
      break;

    default:
      labels.push('No Data');
      data.push(0);
  }

  return { labels, data };
}

// ✅ Level Sensor
// ✅ POST: Store sensor data from TRB245

/* 🚀 INSERT SENSOR DATA */
app.post('/api/levelsensor', async (req, res) => {
  try {
    /* 0️⃣ sanity */
    if (!req.body) return res.status(400).json({ message: 'Empty payload' });

    /** ---------- unpack & prep ---------- **/
    const {
      D         = null,                    // "DD/MM/YYYY HH:mm:ss"
      uid       = null,
      level     = null,
      ts        = null,
      data      = null,                    // array OR single number
      address   = null,                    // keep as plain string
      vehicleNo = null,
      mapKey    = null
    } = req.body;

    /* 1️⃣ ISO timestamp for sorting / querying */
    let dateISO = null;
    if (typeof D === 'string' && D.includes('/')) {
      const [date, time = '00:00:00']   = D.split(' ');
      const [dd, mm, yyyy]              = date.split('/').map(Number);
      const [h,  m,  s]                 = time.split(':').map(Number);
      dateISO = new Date(Date.UTC(yyyy, mm - 1, dd, h, m, s));
    }

    /* 2️⃣ which company does this UID belong to? */
    let companyUid = null;
    const dev = await Device.findOne({ uid }).lean();
    if (dev) companyUid = dev.companyName || null;

    /* 3️⃣ build sensor doc */
    const parsedData = Array.isArray(data)
  ? data.map(d => Math.round(Number(d))) // ensure numeric
  : data === undefined
    ? []
    : [Math.round(Number(data))];

// 🌡️ readings object from mapKey (dynamic mapping)
const readings = {};
if (typeof mapKey === 'string' && Array.isArray(parsedData)) {
  const keys = mapKey.split('_');
  keys.forEach((label, idx) => {
    const rawVal = parsedData[idx];
    if (label && rawVal !== undefined) {
      readings[label] = rawVal / 10; // e.g. 327 → 32.7
    }
  });
}

// 🧾 Store all sensor readings with mapping
const sensorDoc = new LevelSensor({
  D,
  uid,
  level,
  ts,
  address,
  vehicleNo,
  data: parsedData,
  readings,
  mapKey,
  dateISO,
  companyUid
});


    /** ---------- alarm evaluation ---------- **/
    const TH = { highHigh: 50, high: 35, low: 25, lowLow: 10 };
    const alarmsToInsert = [];

    if (Array.isArray(parsedData) && typeof mapKey === 'string') {
  const keys = mapKey.split('_');
  parsedData.forEach((raw, idx) => {
    const deg = raw / 10;
    let level = null;

    if (deg >= TH.highHigh) level = 'HIGH HIGH';
    else if (deg >= TH.high) level = 'HIGH';
    else if (deg <= TH.lowLow) level = 'LOW LOW';
    else if (deg <= TH.low) level = 'LOW';

    const sensorId = keys[idx] || `S${idx + 1}`; // fallback label

    if (level) {
      alarmsToInsert.push({
        uid,
        sensorId,
        value: deg,
        level,
        vehicleNo,
        dateISO: dateISO || new Date(),
        D,
      });
    }
  });
}


    /* 4️⃣ store alarms (if any) */
    if (alarmsToInsert.length) {
      await Alarm.insertMany(alarmsToInsert);
      console.log(`🚨 stored ${alarmsToInsert.length} alarm(s) for ${uid}`);
    }

    /* 5️⃣ e-mail once per "alarm episode" using latch */
try {
  const hasAlarm = alarmsToInsert.length > 0;
  const latched  = alarmLatch[uid] === true;

  console.log(`Latch for ${uid} at start →`, latched);

  /* ─── first alarm of an episode ── */
  if (hasAlarm && !latched) {
    alarmLatch[uid] = true;                       // latch ON

    /* ─── find all active users of the same company ── */
    const deviceDoc = await Device.findOne({ uid }).lean();

    const recipients = deviceDoc
      ? await User.find({
          companyName: deviceDoc.companyName,
          email: { $exists: true, $ne: "" },
          // subscriptionStatus: "active"            // optional filter
          // role: { $in: ["admin", "superadmin"] } // uncomment if needed
        }).select("email -_id").lean()
      : [];

    if (recipients.length) {
      const { subject, html } = alarmEmail({ uid, alarms: alarmsToInsert });

      for (const { email } of recipients) {
        await sendEmail({ to: email, subject, html });
        console.log(`✉️  Alarm mail sent to ${email} for ${uid}`);
      }
    } else {
      console.warn("✉️  No recipients found for uid", uid);
    }
  }

  /* ─── clear latch when readings return to normal ── */
  if (!hasAlarm && latched) {
    alarmLatch[uid] = false;
    console.log(`✅ values normal – latch for ${uid} cleared`);
  }
} catch (mailErr) {
  console.error("✉️  Mail send failed:", mailErr.message);
  // do NOT throw – we still want the sensor data saved
}


    /* 6️⃣ finally save the sensor reading itself */
    await sensorDoc.save();
    res.status(201).json({ message: 'Sensor data saved ✅' });
  } catch (err) {
    console.error('Sensor save error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


/* 🚀 SERVER-SIDE PAGINATION / SEARCH / SORT
 * GET /api/levelsensor?page=1&limit=9&search=&column=&sort=asc|desc
 */
app.get('/api/levelsensor', authenticateToken, async (req, res) => {
  try {
    /* 1. Query params */
    const page   = parseInt(req.query.page  || '1', 10);
    const limit  = parseInt(req.query.limit || '10', 10);
    const skip   = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const column = (req.query.column || '').trim();          // e.g. "vehicleNo"
    const sort   = req.query.sort === 'asc' ? 1 : -1;        // default newest→oldest

    /* 2. Role / company from JWT */
    const { role, companyName } = req.user;

    /* 3. Base filter — admins/users limited to their own devices */
    const mongoFilter = {};
    if (role !== 'superadmin') {
      const devs = await Device.find({ companyName }).select('uid -_id').lean();
      const uids = devs.map(d => d.uid);
      mongoFilter.uid = { $in: uids.length ? uids : ['__none__'] };  // empty fallback
    }

    if (req.query.uid) {
      mongoFilter.uid = req.query.uid;   // no regex ⇒ no prefix collisions
    }
    
    /* 4. Search filter */
    /* 4. Search filter -------------------------------------------------- */
if (search) {
  const rx       = new RegExp(search, "i");
  const numeric  = Number(search);                 // NaN if not a number
  const isNumber = !isNaN(numeric);

  if (column) {
    if (column === "data") {
      /* ── user chose the "Data" column ── */
      if (isNumber) {
        // in DB the value is stored ×10 (27 °C → 270)
        mongoFilter.data = { $elemMatch: { $eq: Math.round(numeric * 10) } };
      } else {
        // if user typed non-numeric, no match for data column
        mongoFilter.data = { $exists: false };     // will return empty set
      }
    } else {
     if (column === 'uid') {
     /* exact (case-insensitive) match → returns only that UID */
     mongoFilter.uid = { $regex: `^${search}$`, $options: 'i' };
   } else {
     mongoFilter[column] = rx;
   }
    }
  } else {
    /* ── "All Columns" search ── */
    mongoFilter.$or = [
      { D:         rx },
      { address:   rx },
      { vehicleNo: rx },
      { uid:       rx },
      isNumber && {
        data: { $elemMatch: { $eq: Math.round(numeric * 10) } }
      }
    ].filter(Boolean);                            // remove false entry if NaN
  }
}


    /* 5. Sort & fetch one page */
    const sortObj = { dateISO: sort };
    const [data, total] = await Promise.all([
      LevelSensor.find(mongoFilter).sort(sortObj).skip(skip).limit(limit).lean(),
      LevelSensor.countDocuments(mongoFilter)
    ]);

    res.json({ data, total });
  } catch (err) {
    console.error('LevelSensor GET error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET /api/levelsensor/latest?uid=TRB245-01
app.get('/api/levelsensor/latest', authenticateToken, async (req, res) => {
  const { uid } = req.query;
  const doc = await LevelSensor.findOne({ uid })
    .sort({ dateISO: -1 })
    .lean();
  if (!doc) return res.status(404).json({ message: 'No data' });
  res.json(doc);
});

// GET /api/alarms?uid=GS-1234&page=1&limit=20
app.get("/api/alarms", authenticateToken, async (req, res) => {
  try {
    const page  = parseInt(req.query.page  || "1", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    const skip  = (page - 1) * limit;
    const uid   = req.query.uid;

    const filter = {};
    if (uid) filter.uid = uid;

    const [data, total] = await Promise.all([
      Alarm.find(filter).sort({ dateISO: -1 }).skip(skip).limit(limit).lean(),
      Alarm.countDocuments(filter),
    ]);

    res.json({ data, total });
  } catch (err) {
    console.error("Alarm GET error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


/* ------------------------------------------------------------------ */

// Google Login 
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(); // We don't need client ID here

app.post('/api/auth/google-login', async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ message: "Missing Google access token" });

  try {
    // Fetch Google profile
    const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const profile = await googleRes.json();

    if (!profile || !profile.email) {
      return res.status(400).json({ message: "Invalid Google token" });
    }

    const { email, name, phone_number } = profile;

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        email,
        name,
        role: 'superadmin',
        companyName: '',
        contactInfo: phone_number || '', // Google may not provide this
        subscriptionStatus: 'inactive',
        subscriptionId: null,
      });

      await user.save();
      console.log("✅ New Google user created:", user.email);
    }

    // Re-check Razorpay subscription (like email login)
    if (user.subscriptionId) {
      try {
        const razorSub = await razorpay.subscriptions.fetch(user.subscriptionId);
        const now = new Date();
        const oneMonthLater = new Date(user.subscriptionStart);
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

        if (razorSub.status !== 'active' || now > oneMonthLater) {
          user.subscriptionStatus = 'inactive';
          await user.save();
        }
      } catch (err) {
        console.warn("⚠️ Razorpay check failed:", err.message);
        user.subscriptionStatus = 'inactive';
        await user.save();
      }
    }

    const tokenPayload = {
      id: user._id,
      role: user.role,
      companyName: user.companyName,
      subscriptionStatus: user.subscriptionStatus || "inactive"
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || "supersecretkey", { expiresIn: '1h' });

    res
      .cookie('token', token, {
        httpOnly: true,
        secure   : isProd, 
        // secure: true,
        sameSite : isProd ? 'None' : 'Lax',
        // sameSite: 'Strict',
        maxAge: 60 * 60 * 1000,
      })
      .json({ message: "Google login successful ✅" });

  } catch (err) {
    console.error("Google login error:", err.message);
    res.status(500).json({ message: "Google login failed ❌" });
  }
});


// ✅ Login with Cookie (Live Subscription Check)
// ✅ Login with Cookie (Live Subscription Check)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials ❌" });
    }

    

    // 🔄 Check Razorpay subscription in real-time if subscriptionId exists
    if (user.subscriptionId) {
      try {
        const razorSub = await razorpay.subscriptions.fetch(user.subscriptionId);

        const now = new Date();
        const oneMonthLater = new Date(user.subscriptionStart);
        oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

        console.log("🔍 Checking subscription expiry:");
console.log("→ Razorpay Status:", razorSub.status);
console.log("→ Now:", now);
console.log("→ Subscription Expiry (one month later):", oneMonthLater);

if (razorSub.status !== 'active') {
  console.log("❌ Razorpay subscription is not active:", razorSub.status);
}

if (now > oneMonthLater) {
  console.log("⏰ Subscription has expired by time limit.");
}

if (razorSub.status !== 'active' || now > oneMonthLater) {
  user.subscriptionStatus = 'inactive';
  await user.save();
  console.log("✅ Updated user subscription to inactive in DB");
} else {
  console.log("✅ Subscription still valid, keeping active.");
}

      } catch (err) {
   console.warn("⚠️ Razorpay API call failed – leaving existing subscriptionStatus untouched:", err.message);
   // NOTE: do NOT overwrite status on pure network / auth errors
   //       Only log and continue.
 }
    }

    // ✅ Re-fetch updated user after saving
    user = await User.findById(user._id);

    // ✅ Generate token with updated subscriptionStatus
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        companyName: user.companyName,
        subscriptionStatus: user.subscriptionStatus || "inactive"
      },
      process.env.JWT_SECRET || "supersecretkey",
      { expiresIn: '2h' }
    );

    res
      .cookie('token', token, {
        httpOnly: true,
        secure   : isProd,
        // secure: true,
        sameSite : isProd ? 'None' : 'Lax',
        // sameSite: 'Strict',
        maxAge: 8 * 60 * 60 * 1000,
      })
      .json({
        message: "Login successful ✅",
        role: user.role,
        companyName: user.companyName,
        subscriptionStatus: user.subscriptionStatus || "inactive"
      });

  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Login failed ❌" });
  }
});

// ✅ Get unique UIDs for dropdown (All sensor devices)
app.get("/api/levelsensor/uids", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;

    let filter = {};

    if (role !== "superadmin") {
      // Only get devices belonging to the logged-in user's company
      const devs = await Device.find({ companyName }).select("uid -_id").lean();
      const uids = devs.map((d) => d.uid);

      // If no matching devices, return early
      if (uids.length === 0) {
        return res.json([]);
      }

      filter.uid = { $in: uids };
    }

    const distinctUIDs = await LevelSensor.distinct("uid", filter);
    return res.json(distinctUIDs);
  } catch (err) {
    console.error("UID Fetch Error:", err);
    return res.status(500).json({ message: "Failed to fetch device UIDs" });
  }
});






// ✅ TEST: Simple test endpoint without authentication
app.get("/api/crane/test", async (req, res) => {
  try {
    res.json({ message: "Crane API is working!", timestamp: new Date() });
  } catch (err) {
    console.error("Test endpoint error:", err);
    res.status(500).json({ error: "Test failed" });
  }
});

// ✅ Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    // secure: true,
      sameSite: isProd ? 'None' : 'Lax'
    // sameSite: 'Strict',
  });
  res.json({ message: 'Logged out successfully ✅' });
});

// ✅ Serve frontend
app.use(express.static(path.join(__dirname, "frontend/dist")));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
