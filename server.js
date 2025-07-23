require('dotenv').config();
console.log('SMTP vars:', process.env.GMAIL_USER, process.env.GMAIL_PASS?.length);

const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./backend/db');
const Device = require('./backend/models/Device');
const User = require('./backend/models/User');
const LevelSensor = require('./backend/models/LevelSensor');

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
const CraneLog = require("./backend/models/CraneLog");

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
connectDB().then(() => {
  console.log('✅ MongoDB connected successfully');
}).catch((err) => {
  console.error('❌ MongoDB connection failed:', err);
});

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

// ✅ POST: Receive crane data from edge device/router (DEBUG VERSION)
app.post("/api/crane/log", async (req, res) => {
  try {
    console.log('🔍 DEBUG - Request headers:', req.headers);
    console.log('🔍 DEBUG - Request body type:', typeof req.body);
    console.log('🔍 DEBUG - Request body:', JSON.stringify(req.body, null, 2));
    console.log('🔍 DEBUG - Request body keys:', Object.keys(req.body || {}));
    
    // ✅ Extract data from request body
    const { craneCompany, DeviceID, Timestamp, Longitude, Latitude, DigitalInput1, DigitalInput2 } = req.body;
    
    console.log('🔍 DEBUG - Extracted values:');
    console.log('  craneCompany:', craneCompany);
    console.log('  DeviceID:', DeviceID);
    console.log('  Timestamp:', Timestamp);
    console.log('  Longitude:', Longitude);
    console.log('  Latitude:', Latitude);
    console.log('  DigitalInput1:', DigitalInput1);
    console.log('  DigitalInput2:', DigitalInput2);
    
    // ✅ Validate required fields
    if (!craneCompany || !DeviceID || !Timestamp || !Longitude || !Latitude || !DigitalInput1 || !DigitalInput2) {
      console.log('❌ Missing required fields:', { 
        craneCompany: !!craneCompany, 
        DeviceID: !!DeviceID, 
        Timestamp: !!Timestamp, 
        Longitude: !!Longitude, 
        Latitude: !!Latitude, 
        DigitalInput1: !!DigitalInput1, 
        DigitalInput2: !!DigitalInput2 
      });
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ Create new crane log entry
    const craneLog = new CraneLog({
      craneCompany,
      DeviceID,
      Timestamp,
      Longitude,
      Latitude,
      DigitalInput1,
      DigitalInput2
    });
    
    // ✅ Save to database
    const savedLog = await craneLog.save();
    
    console.log('✅ Crane log saved successfully:', savedLog._id);

    // ✅ Return success response
    res.status(201).json({ 
      message: "Crane data saved successfully",
      logId: savedLog._id,
      deviceId: savedLog.DeviceID,
      timestamp: savedLog.Timestamp
    });
    
  } catch (err) {
    console.error("❌ Crane log save error:", err);
    res.status(500).json({ error: "Failed to save crane data" });
  }
});

// ✅ GET: Fetch crane overview data for dashboard (with real-time ongoing hours)
app.get("/api/crane/overview", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    
    console.log('🔍 User requesting crane data:', { role, companyName });
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Get all crane devices for this company only
    const craneDevices = await CraneLog.distinct("DeviceID", companyFilter);
    
    if (craneDevices.length === 0) {
      return res.json({
        totalWorkingHours: 0,
        completedHours: 0,
        ongoingHours: 0,
        activeCranes: 0,
        inactiveCranes: 0,
        underMaintenance: 0,
        quickStats: {
          todayOperations: 0,
          thisWeekOperations: 0,
          thisMonthOperations: 0
        }
      });
    }

    // ✅ Calculate total working hours for all cranes
    let totalWorkingHours = 0;
    let completedHours = 0;
    let ongoingHours = 0;
    let activeCranes = 0;
    let inactiveCranes = 0;
    let underMaintenance = 0;

    // ✅ Process each crane device
    for (const deviceId of craneDevices) {
      const deviceFilter = { ...companyFilter, DeviceID: deviceId };
      
      // Get all logs for this device - SORT BY TIMESTAMP, not createdAt
      const deviceLogs = await CraneLog.find(deviceFilter)
        .lean();
      
      // ✅ Sort by actual timestamp (not database creation time)
      deviceLogs.sort((a, b) => {
        const [aDate, aTime] = a.Timestamp.split(' ');
        const [aDay, aMonth, aYear] = aDate.split('/').map(Number);
        const [aHour, aMinute, aSecond] = aTime.split(':').map(Number);
        const aTimestamp = new Date(aYear, aMonth - 1, aDay, aHour, aMinute, aSecond);
        
        const [bDate, bTime] = b.Timestamp.split(' ');
        const [bDay, bMonth, bYear] = bDate.split('/').map(Number);
        const [bHour, bMinute, bSecond] = bTime.split(':').map(Number);
        const bTimestamp = new Date(bYear, bMonth - 1, bDay, bHour, bMinute, bSecond);
        
        return aTimestamp - bTimestamp;
      });

      if (deviceLogs.length === 0) continue;

      // ✅ Calculate working hours for this device
      let deviceCompletedHours = 0;
      let deviceOngoingHours = 0;
      let hasOngoingSession = false;

      // ✅ Process completed sessions (start → stop)
      for (let i = 0; i < deviceLogs.length - 1; i++) {
        const currentLog = deviceLogs[i];
        const nextLog = deviceLogs[i + 1];

        // ✅ Only count as completed when DigitalInput1 changes from "1" to "0" (start → stop)
        if (currentLog.DigitalInput1 === "1" && nextLog.DigitalInput1 === "0") {
          try {
            // ✅ Parse timestamps correctly - Convert IST to UTC
            const [currentDatePart, currentTimePart] = currentLog.Timestamp.split(' ');
            const [currentDay, currentMonth, currentYear] = currentDatePart.split('/').map(Number);
            const [currentHour, currentMinute, currentSecond] = currentTimePart.split(':').map(Number);
            // ✅ Create IST time and convert to UTC (IST = UTC+5:30)
            const currentTimeIST = new Date(currentYear, currentMonth - 1, currentDay, currentHour, currentMinute, currentSecond);
            const currentTime = new Date(currentTimeIST.getTime() - (5.5 * 60 * 60 * 1000)); // Convert IST to UTC
            
            const [nextDatePart, nextTimePart] = nextLog.Timestamp.split(' ');
            const [nextDay, nextMonth, nextYear] = nextDatePart.split('/').map(Number);
            const [nextHour, nextMinute, nextSecond] = nextTimePart.split(':').map(Number);
            // ✅ Create IST time and convert to UTC
            const nextTimeIST = new Date(nextYear, nextMonth - 1, nextDay, nextHour, nextMinute, nextSecond);
            const nextTime = new Date(nextTimeIST.getTime() - (5.5 * 60 * 60 * 1000)); // Convert IST to UTC
            
            // Calculate hours difference
            const hoursDiff = (nextTime - currentTime) / (1000 * 60 * 60);
            deviceCompletedHours += hoursDiff;
            
            console.log(`✅ Crane ${deviceId} completed session: ${currentLog.Timestamp} to ${nextLog.Timestamp} = ${hoursDiff.toFixed(2)} hours`);
          } catch (err) {
            console.error(`❌ Error parsing timestamps for crane ${deviceId}:`, err);
            // Fallback to using createdAt timestamps
            const hoursDiff = (new Date(nextLog.createdAt) - new Date(currentLog.createdAt)) / (1000 * 60 * 60);
            deviceCompletedHours += hoursDiff;
          }
        }
      }

      // ✅ Check for ongoing session (latest log) - ADD THIS DEBUG
const latestLog = deviceLogs[deviceLogs.length - 1];
if (latestLog.DigitalInput1 === "1") {
  console.log(`🔍 DEBUG: Crane ${deviceId} is currently operating`);
  console.log(`🔍 DEBUG: Latest timestamp: ${latestLog.Timestamp}`);
  
  try {
    const [latestDatePart, latestTimePart] = latestLog.Timestamp.split(' ');
    const [latestDay, latestMonth, latestYear] = latestDatePart.split('/').map(Number);
    const [latestHour, latestMinute, latestSecond] = latestTimePart.split(':').map(Number);
    // ✅ Create IST time and convert to UTC (IST = UTC+5:30)
    const latestTimeIST = new Date(latestYear, latestMonth - 1, latestDay, latestHour, latestMinute, latestSecond);
    const latestTime = new Date(latestTimeIST.getTime() - (5.5 * 60 * 60 * 1000)); // Convert IST to UTC
    
    const now = new Date();
    const ongoingHoursDiff = (now - latestTime) / (1000 * 60 * 60);
    
    console.log(`�� DEBUG: Latest time parsed: ${latestTime}`);
    console.log(`🔍 DEBUG: Current time: ${now}`);
    console.log(`🔍 DEBUG: Ongoing hours calculated: ${ongoingHoursDiff}`);
    
    // ✅ Handle timezone issues - if negative, assume it's a timezone problem
    if (ongoingHoursDiff > 0 && ongoingHoursDiff < 24) {
      deviceOngoingHours = ongoingHoursDiff;
      hasOngoingSession = true;
      console.log(`✅ Crane ${deviceId} ongoing session: ${latestLog.Timestamp} to now = ${ongoingHoursDiff.toFixed(2)} hours`);
    } else if (ongoingHoursDiff < 0 && ongoingHoursDiff > -24) {
      // ✅ Timezone issue - treat as ongoing session from latest timestamp
      deviceOngoingHours = Math.abs(ongoingHoursDiff);
      hasOngoingSession = true;
      console.log(`✅ Crane ${deviceId} ongoing session (timezone adjusted): ${latestLog.Timestamp} to now = ${deviceOngoingHours.toFixed(2)} hours`);
    } else {
      console.log(`❌ Ongoing hours rejected: ${ongoingHoursDiff} (outside valid range)`);
    }
  } catch (err) {
    console.error(`❌ Error calculating ongoing hours for crane ${deviceId}:`, err);
  }
} else {
  console.log(`🔍 DEBUG: Crane ${deviceId} is not currently operating (DigitalInput1: ${latestLog.DigitalInput1})`);
}

      // ✅ Check current status for crane counts
      if (latestLog.DigitalInput1 === "1") {
        activeCranes++;
      } else if (latestLog.DigitalInput2 === "1") {
        underMaintenance++;
      } else {
        inactiveCranes++;
      }

      // ✅ Add to totals
      completedHours += deviceCompletedHours;
      ongoingHours += deviceOngoingHours;
      totalWorkingHours = completedHours + ongoingHours;

      console.log(`📊 Crane ${deviceId} summary: ${deviceCompletedHours.toFixed(2)}h completed + ${deviceOngoingHours.toFixed(2)}h ongoing`);
    }

    // ✅ Calculate period-based working hours
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const yearStart = new Date(now.getFullYear(), 0, 1); // January 1st of current year

    // ✅ Helper function to calculate working hours for a period
    async function calculateWorkingHoursForPeriod(startDate, endDate = now) {
      let periodCompletedHours = 0;
      let periodOngoingHours = 0;

      for (const deviceId of craneDevices) {
        const deviceFilter = { ...companyFilter, DeviceID: deviceId };
        
        // Get logs within the period
        const periodLogs = await CraneLog.find({
          ...deviceFilter,
          createdAt: { $gte: startDate, $lte: endDate }
        }).lean();

        if (periodLogs.length === 0) continue;

        // Sort by timestamp
        periodLogs.sort((a, b) => {
          const [aDate, aTime] = a.Timestamp.split(' ');
          const [aDay, aMonth, aYear] = aDate.split('/').map(Number);
          const [aHour, aMinute, aSecond] = aTime.split(':').map(Number);
          const aTimestamp = new Date(aYear, aMonth - 1, aDay, aHour, aMinute, aSecond);
          
          const [bDate, bTime] = b.Timestamp.split(' ');
          const [bDay, bMonth, bYear] = bDate.split('/').map(Number);
          const [bHour, bMinute, bSecond] = bTime.split(':').map(Number);
          const bTimestamp = new Date(bYear, bMonth - 1, bDay, bHour, bMinute, bSecond);
          
          return aTimestamp - bTimestamp;
        });

        // Calculate completed sessions within period
        for (let i = 0; i < periodLogs.length - 1; i++) {
          const currentLog = periodLogs[i];
          const nextLog = periodLogs[i + 1];

          if (currentLog.DigitalInput1 === "1" && nextLog.DigitalInput1 === "0") {
            try {
              const [currentDatePart, currentTimePart] = currentLog.Timestamp.split(' ');
              const [currentDay, currentMonth, currentYear] = currentDatePart.split('/').map(Number);
              const [currentHour, currentMinute, currentSecond] = currentTimePart.split(':').map(Number);
              const currentTimeIST = new Date(currentYear, currentMonth - 1, currentDay, currentHour, currentMinute, currentSecond);
              const currentTime = new Date(currentTimeIST.getTime() - (5.5 * 60 * 60 * 1000));
              
              const [nextDatePart, nextTimePart] = nextLog.Timestamp.split(' ');
              const [nextDay, nextMonth, nextYear] = nextDatePart.split('/').map(Number);
              const [nextHour, nextMinute, nextSecond] = nextTimePart.split(':').map(Number);
              const nextTimeIST = new Date(nextYear, nextMonth - 1, nextDay, nextHour, nextMinute, nextSecond);
              const nextTime = new Date(nextTimeIST.getTime() - (5.5 * 60 * 60 * 1000));
              
              const hoursDiff = (nextTime - currentTime) / (1000 * 60 * 60);
              periodCompletedHours += hoursDiff;
            } catch (err) {
              console.error(`❌ Error parsing timestamps for period calculation:`, err);
            }
          }
        }

        // Check for ongoing sessions that started within the period
        const latestLog = periodLogs[periodLogs.length - 1];
        if (latestLog && latestLog.DigitalInput1 === "1") {
          try {
            const [latestDatePart, latestTimePart] = latestLog.Timestamp.split(' ');
            const [latestDay, latestMonth, latestYear] = latestDatePart.split('/').map(Number);
            const [latestHour, latestMinute, latestSecond] = latestTimePart.split(':').map(Number);
            const latestTimeIST = new Date(latestYear, latestMonth - 1, latestDay, latestHour, latestMinute, latestSecond);
            const latestTime = new Date(latestTimeIST.getTime() - (5.5 * 60 * 60 * 1000));
            
            const ongoingHoursDiff = (now - latestTime) / (1000 * 60 * 60);
            if (ongoingHoursDiff > 0 && ongoingHoursDiff < 24) {
              periodOngoingHours += ongoingHoursDiff;
            }
          } catch (err) {
            console.error(`❌ Error calculating ongoing hours for period:`, err);
          }
        }
      }

      return {
        completed: Math.round(periodCompletedHours * 100) / 100,
        ongoing: Math.round(periodOngoingHours * 100) / 100,
        total: Math.round((periodCompletedHours + periodOngoingHours) * 100) / 100
      };
    }

    // ✅ Calculate working hours for all periods
    const [todayStats, thisWeekStats, thisMonthStats, thisYearStats] = await Promise.all([
      calculateWorkingHoursForPeriod(today),
      calculateWorkingHoursForPeriod(weekAgo),
      calculateWorkingHoursForPeriod(monthAgo),
      calculateWorkingHoursForPeriod(yearStart)
    ]);

    console.log(`📊 Final totals: ${completedHours.toFixed(2)}h completed + ${ongoingHours.toFixed(2)}h ongoing = ${totalWorkingHours.toFixed(2)}h total`);

    res.json({
      totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
      completedHours: Math.round(completedHours * 100) / 100,
      ongoingHours: Math.round(ongoingHours * 100) / 100,
      activeCranes,
      inactiveCranes,
      underMaintenance,
      quickStats: {
        today: todayStats,
        thisWeek: thisWeekStats,
        thisMonth: thisMonthStats,
        thisYear: thisYearStats
      }
    });

  } catch (err) {
    console.error("❌ Crane overview fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ GET: Fetch crane devices for dropdown (filtered by company)
app.get("/api/crane/devices", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    
    console.log('🔍 User requesting crane devices:', { role, companyName });
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Get unique crane devices for this company
    const craneDevices = await CraneLog.distinct("DeviceID", companyFilter);
    
    // ✅ Get latest log for each device to get location info
    const devicesWithInfo = await Promise.all(
      craneDevices.map(async (deviceId) => {
        const latestLog = await CraneLog.findOne(
          { ...companyFilter, DeviceID: deviceId },
          { Longitude: 1, Latitude: 1, Timestamp: 1 },
          { sort: { createdAt: -1 } }
        ).lean();
        
        return {
          DeviceID: deviceId,
          location: `${latestLog?.Latitude || 'N/A'}, ${latestLog?.Longitude || 'N/A'}`,
          lastUpdate: latestLog?.Timestamp || 'Never'
        };
      })
    );
    
    console.log(`✅ Found ${devicesWithInfo.length} crane devices for ${companyName}`);
    
    res.json(devicesWithInfo);
    
  } catch (err) {
    console.error("❌ Crane devices fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ GET: Fetch individual crane status
app.get("/api/crane/status", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    const { deviceId } = req.query;
    
    console.log('🔍 User requesting crane status:', { role, companyName, deviceId });
    
    if (!deviceId) {
      return res.status(400).json({ error: "Device ID is required" });
    }
    
    // ✅ Filter by company and device
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    const deviceFilter = { ...companyFilter, DeviceID: deviceId };
    
    // ✅ Get latest log for this device
    const latestLog = await CraneLog.findOne(deviceFilter)
      .sort({ createdAt: -1 })
      .lean();
    
    if (!latestLog) {
      return res.status(404).json({ error: "Crane device not found" });
    }
    
    // ✅ Determine status based on DigitalInput values
    let status = "Unknown";
    let statusColor = "secondary";
    let isOperating = false;
    let isDown = false;
    
    if (latestLog.DigitalInput1 === "1") {
      status = "Operating";
      statusColor = "success";
      isOperating = true;
    } else if (latestLog.DigitalInput2 === "1") {
      status = "Maintenance";
      statusColor = "warning";
      isDown = true;
    } else {
      status = "Idle";
      statusColor = "info";
    }
    
    const craneStatus = {
      status,
      statusColor,
      isOperating,
      isDown,
      lastUpdate: latestLog.Timestamp,
      location: `${latestLog.Latitude}, ${latestLog.Longitude}`,
      deviceId: latestLog.DeviceID
    };
    
    console.log(`✅ Crane ${deviceId} status: ${status}`);
    
    res.json(craneStatus);
    
  } catch (err) {
    console.error("❌ Crane status fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ GET: Fetch individual crane activity data
app.get("/api/crane/activity", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    const { deviceId } = req.query;
    
    console.log('🔍 User requesting crane activity:', { role, companyName, deviceId });
    
    if (!deviceId) {
      return res.status(400).json({ error: "Device ID is required" });
    }
    
    // ✅ Filter by company and device
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    const deviceFilter = { ...companyFilter, DeviceID: deviceId };
    
    // ✅ Get all logs for this device
    const deviceLogs = await CraneLog.find(deviceFilter)
      .sort({ createdAt: 1 })
      .lean();
    
    if (deviceLogs.length === 0) {
      return res.json({
        todayHours: 0,
        weekHours: 0,
        monthHours: 0,
        totalHours: 0,
        completedSessions: 0,
        ongoingHours: 0
      });
    }
    
    // ✅ Sort by timestamp
    deviceLogs.sort((a, b) => {
      const [aDate, aTime] = a.Timestamp.split(' ');
      const [aDay, aMonth, aYear] = aDate.split('/').map(Number);
      const [aHour, aMinute, aSecond] = aTime.split(':').map(Number);
      const aTimestamp = new Date(aYear, aMonth - 1, aDay, aHour, aMinute, aSecond);
      
      const [bDate, bTime] = b.Timestamp.split(' ');
      const [bDay, bMonth, bYear] = bDate.split('/').map(Number);
      const [bHour, bMinute, bSecond] = bTime.split(':').map(Number);
      const bTimestamp = new Date(bYear, bMonth - 1, bDay, bHour, bMinute, bSecond);
      
      return aTimestamp - bTimestamp;
    });
    
    // ✅ Calculate working hours for different periods
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // ✅ Helper function to calculate hours for a period
    function calculateHoursForPeriod(startDate, endDate = now) {
      let completedHours = 0;
      let ongoingHours = 0;
      
      // Filter logs within period
      const periodLogs = deviceLogs.filter(log => {
        const [datePart, timePart] = log.Timestamp.split(' ');
        const [day, month, year] = datePart.split('/').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        const logTime = new Date(year, month - 1, day, hour, minute, second);
        const logTimeIST = new Date(logTime.getTime() + (5.5 * 60 * 60 * 1000)); // Convert to IST
        return logTimeIST >= startDate && logTimeIST <= endDate;
      });
      
      // Calculate completed sessions
      for (let i = 0; i < periodLogs.length - 1; i++) {
        const currentLog = periodLogs[i];
        const nextLog = periodLogs[i + 1];
        
        if (currentLog.DigitalInput1 === "1" && nextLog.DigitalInput1 === "0") {
          try {
            const [currentDatePart, currentTimePart] = currentLog.Timestamp.split(' ');
            const [currentDay, currentMonth, currentYear] = currentDatePart.split('/').map(Number);
            const [currentHour, currentMinute, currentSecond] = currentTimePart.split(':').map(Number);
            const currentTimeIST = new Date(currentYear, currentMonth - 1, currentDay, currentHour, currentMinute, currentSecond);
            const currentTime = new Date(currentTimeIST.getTime() - (5.5 * 60 * 60 * 1000));
            
            const [nextDatePart, nextTimePart] = nextLog.Timestamp.split(' ');
            const [nextDay, nextMonth, nextYear] = nextDatePart.split('/').map(Number);
            const [nextHour, nextMinute, nextSecond] = nextTimePart.split(':').map(Number);
            const nextTimeIST = new Date(nextYear, nextMonth - 1, nextDay, nextHour, nextMinute, nextSecond);
            const nextTime = new Date(nextTimeIST.getTime() - (5.5 * 60 * 60 * 1000));
            
            const hoursDiff = (nextTime - currentTime) / (1000 * 60 * 60);
            completedHours += hoursDiff;
          } catch (err) {
            console.error(`❌ Error parsing timestamps for activity calculation:`, err);
          }
        }
      }
      
      // Check for ongoing session
      const latestLog = periodLogs[periodLogs.length - 1];
      if (latestLog && latestLog.DigitalInput1 === "1") {
        try {
          const [latestDatePart, latestTimePart] = latestLog.Timestamp.split(' ');
          const [latestDay, latestMonth, latestYear] = latestDatePart.split('/').map(Number);
          const [latestHour, latestMinute, latestSecond] = latestTimePart.split(':').map(Number);
          const latestTimeIST = new Date(latestYear, latestMonth - 1, latestDay, latestHour, latestMinute, latestSecond);
          const latestTime = new Date(latestTimeIST.getTime() - (5.5 * 60 * 60 * 1000));
          
          const ongoingHoursDiff = (now - latestTime) / (1000 * 60 * 60);
          if (ongoingHoursDiff > 0 && ongoingHoursDiff < 24) {
            ongoingHours = ongoingHoursDiff;
          }
        } catch (err) {
          console.error(`❌ Error calculating ongoing hours for activity:`, err);
        }
      }
      
      return completedHours + ongoingHours;
    }
    
    // ✅ Calculate hours for different periods
    const todayHours = calculateHoursForPeriod(today);
    const weekHours = calculateHoursForPeriod(weekAgo);
    const monthHours = calculateHoursForPeriod(monthAgo);
    const totalHours = calculateHoursForPeriod(new Date(0)); // All time
    
    // ✅ Count completed sessions
    let completedSessions = 0;
    for (let i = 0; i < deviceLogs.length - 1; i++) {
      if (deviceLogs[i].DigitalInput1 === "1" && deviceLogs[i + 1].DigitalInput1 === "0") {
        completedSessions++;
      }
    }
    
    const craneActivity = {
      todayHours: Math.round(todayHours * 100) / 100,
      weekHours: Math.round(weekHours * 100) / 100,
      monthHours: Math.round(monthHours * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
      completedSessions,
      ongoingHours: Math.round(ongoingHours * 100) / 100
    };
    
    console.log(`✅ Crane ${deviceId} activity calculated:`, craneActivity);
    
    res.json(craneActivity);
    
  } catch (err) {
    console.error("❌ Crane activity fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
