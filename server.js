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
const { calculateAllCraneDistances, getCurrentDateString, validateGPSData, calculateDistance } = require("./backend/utils/locationUtils");

// ✅ Environment-based timezone helper function
function getCurrentTimeInIST() {
  if (isProd) {
    // Production (Azure): Convert UTC to IST
    const nowUTC = new Date();
    return new Date(nowUTC.getTime() + (5.5 * 60 * 60 * 1000)); // Convert UTC to IST
  } else {
    // Local Development: Already in IST, no conversion needed
    return new Date();
  }
}

// ✅ Environment-based timestamp conversion helper
function convertISTToUTC(istTime) {
  if (isProd) {
    // Production: Convert IST to UTC for calculation
    return new Date(istTime.getTime() - (5.5 * 60 * 60 * 1000));
  } else {
    // Local Development: Keep in IST, no conversion needed
    return istTime;
  }
}

// ✅ NEW: Helper function to parse timestamp string to Date object
function parseTimestamp(timestampStr) {
  try {
    const [datePart, timePart] = timestampStr.split(' ');
    const [day, month, year] = datePart.split('/').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, second);
  } catch (err) {
    console.error(`❌ Error parsing timestamp: ${timestampStr}`, err);
    return null;
  }
}

// ✅ NEW: Helper function to calculate consecutive periods for periodic data
function calculateConsecutivePeriods(logs, statusType) {
  const periods = [];
  let currentPeriod = null;
  
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const timestamp = parseTimestamp(log.Timestamp);
    if (!timestamp) continue;
    
    let currentStatus = null;
    
    // Determine status based on statusType
    if (statusType === 'working') {
      // ✅ NEW: Exclude periods where both inputs are "1" (maintenance priority)
      currentStatus = (log.DigitalInput1 === "1" && log.DigitalInput2 === "0") ? "1" : "0";
    } else if (statusType === 'maintenance') {
      currentStatus = log.DigitalInput2;
    } else if (statusType === 'idle') {
      currentStatus = (log.DigitalInput1 === "0" && log.DigitalInput2 === "0") ? "1" : "0";
    }
    
    if (currentStatus === "1") {
      // Status is active
      if (!currentPeriod) {
        // Start new period
        currentPeriod = {
          startTime: timestamp,
          startTimestamp: log.Timestamp,
          logs: [log]
        };
      } else {
        // Continue current period
        currentPeriod.logs.push(log);
      }
    } else {
      // Status is inactive
      if (currentPeriod) {
        // End current period
        currentPeriod.endTime = timestamp;
        currentPeriod.endTimestamp = log.Timestamp;
        currentPeriod.duration = (currentPeriod.endTime - currentPeriod.startTime) / (1000 * 60 * 60);
        currentPeriod.isOngoing = false;
        periods.push(currentPeriod);
        currentPeriod = null;
      }
    }
  }
  
  // Handle ongoing period (last period that hasn't ended)
  if (currentPeriod) {
    currentPeriod.isOngoing = true;
    currentPeriod.endTime = null;
    currentPeriod.endTimestamp = null;
    // ✅ Calculate duration for ongoing sessions using current time
    currentPeriod.duration = calculatePeriodDuration(currentPeriod.startTime, getCurrentTimeInIST(), true);
    periods.push(currentPeriod);
  }
  
  return periods;
}

// ✅ NEW: Helper function to calculate period duration including ongoing sessions
function calculatePeriodDuration(startTime, endTime = null, isOngoing = false) {
  if (!startTime) return 0;
  
  const end = endTime || getCurrentTimeInIST();
  const duration = (end - startTime) / (1000 * 60 * 60);
  
  return Math.max(0, duration); // Ensure non-negative
}

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

// ✅ POST: Receive crane data from edge device/router (UPDATED FOR NEW FORMAT)
app.post("/api/crane/log", async (req, res) => {
  try {
    console.log('🔍 DEBUG - Request headers:', req.headers);
    console.log('🔍 DEBUG - Request body type:', typeof req.body);
    console.log('🔍 DEBUG - Request body:', JSON.stringify(req.body, null, 2));
    console.log('🔍 DEBUG - Request body keys:', Object.keys(req.body || {}));
    
    let transformedData = null;
    
    // ✅ Check if this is the new format (array of objects with dataType)
    if (Array.isArray(req.body) && req.body.length > 0 && req.body[0].dataType) {
      console.log('🔄 Processing NEW format data...');
      
      // ✅ Transform new format to old format
      transformedData = transformNewFormatToOld(req.body);
      
      console.log('✅ Transformed data:', transformedData);
      
    } else {
      console.log('🔄 Processing OLD format data...');
      
      // ✅ Use existing format directly
      const { craneCompany, DeviceID, Timestamp, Longitude, Latitude, DigitalInput1, DigitalInput2 } = req.body;
      
      transformedData = {
        craneCompany,
        DeviceID,
        Timestamp,
        Longitude,
        Latitude,
        DigitalInput1,
        DigitalInput2
      };
    }
    
    console.log('🔍 DEBUG - Final extracted values:');
    console.log('  craneCompany:', transformedData.craneCompany);
    console.log('  DeviceID:', transformedData.DeviceID);
    console.log('  Timestamp:', transformedData.Timestamp);
    console.log('  Longitude:', transformedData.Longitude);
    console.log('  Latitude:', transformedData.Latitude);
    console.log('  DigitalInput1:', transformedData.DigitalInput1);
    console.log('  DigitalInput2:', transformedData.DigitalInput2);
    
    // ✅ Validate required fields
    if (!transformedData.craneCompany || !transformedData.DeviceID || !transformedData.Timestamp || 
        !transformedData.Longitude || !transformedData.Latitude || 
        !transformedData.DigitalInput1 || !transformedData.DigitalInput2) {
      console.log('❌ Missing required fields after transformation:', { 
        craneCompany: !!transformedData.craneCompany, 
        DeviceID: !!transformedData.DeviceID, 
        Timestamp: !!transformedData.Timestamp, 
        Longitude: !!transformedData.Longitude, 
        Latitude: !!transformedData.Latitude, 
        DigitalInput1: !!transformedData.DigitalInput1, 
        DigitalInput2: !!transformedData.DigitalInput2 
      });
      return res.status(400).json({ error: "Missing required fields after transformation" });
    }

    // ✅ Create new crane log entry
    const craneLog = new CraneLog(transformedData);
    
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

// ✅ Helper function to transform new format to old format
function transformNewFormatToOld(dataArray) {
  try {
    console.log('🔄 Starting transformation of new format data...');
    
    // ✅ Initialize with default values
    let transformedData = {
      craneCompany: null,
      DeviceID: null,
      Timestamp: null,
      Longitude: "0.000000",
      Latitude: "0.000000",
      DigitalInput1: "0",
      DigitalInput2: "0"
    };
    
    // ✅ Process each object in the array
    dataArray.forEach((item, index) => {
      console.log(`🔍 Processing item ${index + 1}:`, item);
      
      // ✅ Extract common fields (should be same for all items)
      if (!transformedData.craneCompany) transformedData.craneCompany = item.craneCompany;
      if (!transformedData.DeviceID) transformedData.DeviceID = item.DeviceID;
      if (!transformedData.Timestamp) transformedData.Timestamp = item.Timestamp;
      
      // ✅ Parse data based on dataType
      try {
        const parsedData = JSON.parse(item.data);
        
        switch (item.dataType) {
          case "Gps":
            if (Array.isArray(parsedData) && parsedData.length >= 2) {
              transformedData.Latitude = parsedData[0].toString();
              transformedData.Longitude = parsedData[1].toString();
              console.log(`✅ GPS data parsed: lat=${transformedData.Latitude}, lon=${transformedData.Longitude}`);
            }
            break;
            
          case "maintenance":
            if (Array.isArray(parsedData) && parsedData.length >= 1) {
              transformedData.DigitalInput2 = parsedData[0].toString();
              console.log(`✅ Maintenance data parsed: DigitalInput2=${transformedData.DigitalInput2}`);
            }
            break;
            
          case "Ignition":
            if (Array.isArray(parsedData) && parsedData.length >= 1) {
              transformedData.DigitalInput1 = parsedData[0].toString();
              console.log(`✅ Ignition data parsed: DigitalInput1=${transformedData.DigitalInput1}`);
            }
            break;
            
          default:
            console.log(`⚠️ Unknown dataType: ${item.dataType}`);
        }
      } catch (parseError) {
        console.error(`❌ Error parsing data for ${item.dataType}:`, parseError);
      }
    });
    
    console.log('✅ Transformation completed:', transformedData);
    return transformedData;
    
  } catch (error) {
    console.error('❌ Error in transformNewFormatToOld:', error);
    throw error;
  }
}

// ✅ GET: Fetch crane overview data for dashboard (with periodic data logic)
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
        craneDevices: [], // ✅ Add crane devices to response
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
      
      // Get all logs for this device
      const deviceLogs = await CraneLog.find(deviceFilter).lean();
      
      // ✅ Sort by actual timestamp (not database creation time)
      deviceLogs.sort((a, b) => {
        const aTimestamp = parseTimestamp(a.Timestamp);
        const bTimestamp = parseTimestamp(b.Timestamp);
        if (!aTimestamp || !bTimestamp) return 0;
        return aTimestamp - bTimestamp;
      });

      if (deviceLogs.length === 0) continue;

      // ✅ NEW: Use periodic data logic - Calculate consecutive periods
      const workingPeriods = calculateConsecutivePeriods(deviceLogs, 'working');
      const maintenancePeriods = calculateConsecutivePeriods(deviceLogs, 'maintenance');
      
      let deviceCompletedHours = 0;
      let deviceOngoingHours = 0;
      let hasOngoingSession = false;

      // ✅ Process completed working periods
      workingPeriods.forEach(period => {
        if (!period.isOngoing) {
          deviceCompletedHours += period.duration;
          console.log(`✅ Crane ${deviceId} completed working session: ${period.startTimestamp} to ${period.endTimestamp} = ${period.duration.toFixed(2)} hours`);
        } else {
          // Ongoing working session
          const ongoingDuration = calculatePeriodDuration(period.startTime);
          deviceOngoingHours += ongoingDuration;
          hasOngoingSession = true;
          console.log(`✅ Crane ${deviceId} ongoing working session: ${period.startTimestamp} to now = ${ongoingDuration.toFixed(2)} hours`);
        }
      });

      // ✅ Check for ongoing session (latest log) - ADD THIS DEBUG
const latestLog = deviceLogs[deviceLogs.length - 1];
if (latestLog.DigitalInput1 === "1") {
  console.log(`🔍 DEBUG: Crane ${deviceId} is currently operating`);
  console.log(`🔍 DEBUG: Latest timestamp: ${latestLog.Timestamp}`);
  
  try {
    const [latestDatePart, latestTimePart] = latestLog.Timestamp.split(' ');
    const [latestDay, latestMonth, latestYear] = latestDatePart.split('/').map(Number);
    const [latestHour, latestMinute, latestSecond] = latestTimePart.split(':').map(Number);
    // ✅ Create IST time - keep in IST for ongoing calculation
    const latestTimeIST = new Date(latestYear, latestMonth - 1, latestDay, latestHour, latestMinute, latestSecond);
    
    const now = getCurrentTimeInIST();
    const ongoingHoursDiff = (now - latestTimeIST) / (1000 * 60 * 60);
    
    console.log(`�� DEBUG: Latest time parsed: ${latestTimeIST}`);
    console.log(`🔍 DEBUG: Current time: ${now}`);
    console.log(`🔍 DEBUG: Ongoing hours calculated: ${ongoingHoursDiff}`);
    
    // ✅ Handle ongoing sessions with environment-based timezone logic
    if (ongoingHoursDiff > 0 && ongoingHoursDiff < 72) { // Allow up to 3 days for ongoing sessions
      deviceOngoingHours = ongoingHoursDiff;
      hasOngoingSession = true;
      console.log(`✅ Crane ${deviceId} ongoing session: ${latestLog.Timestamp} to now = ${ongoingHoursDiff.toFixed(2)} hours`);
    } else if (ongoingHoursDiff < 0 && ongoingHoursDiff > -72) {
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

      // ✅ Check current status for crane counts (MAINTENANCE PRIORITY)
      if (latestLog.DigitalInput2 === "1") {
        underMaintenance++;
      } else if (latestLog.DigitalInput1 === "1") {
        activeCranes++;
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
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1); // ✅ First day of current month
    const yearStart = new Date(now.getFullYear(), 0, 1); // January 1st of current year

    // ✅ NEW: Helper function to calculate working hours for a period using periodic data logic
    async function calculateWorkingHoursForPeriod(startDate, endDate = getCurrentTimeInIST()) {
      let periodCompletedHours = 0;
      let periodOngoingHours = 0;

      for (const deviceId of craneDevices) {
        const deviceFilter = { ...companyFilter, DeviceID: deviceId };
        
        // Get ALL logs for this device (not just within period)
        const allDeviceLogs = await CraneLog.find(deviceFilter).lean();
        
        // Sort by timestamp
        allDeviceLogs.sort((a, b) => {
          const aTimestamp = parseTimestamp(a.Timestamp);
          const bTimestamp = parseTimestamp(b.Timestamp);
          if (!aTimestamp || !bTimestamp) return 0;
          return aTimestamp - bTimestamp;
        });

        if (allDeviceLogs.length === 0) continue;

        // ✅ NEW: Use periodic data logic - Calculate consecutive periods from ALL logs
        const workingPeriods = calculateConsecutivePeriods(allDeviceLogs, 'working');

        // Process working periods - check if they overlap with the period
        workingPeriods.forEach(period => {
          if (!period.isOngoing) {
            // Completed period - check if it overlaps with our period
            const periodEnd = period.startTime.getTime() + (period.duration * 60 * 60 * 1000);
            const periodStart = period.startTime.getTime();
            const queryStart = startDate.getTime();
            const queryEnd = endDate.getTime();
            
            // Check if period overlaps with query period
            if (periodStart < queryEnd && periodEnd > queryStart) {
              // Calculate overlap
              const overlapStart = Math.max(periodStart, queryStart);
              const overlapEnd = Math.min(periodEnd, queryEnd);
              const overlapHours = (overlapEnd - overlapStart) / (1000 * 60 * 60);
              periodCompletedHours += overlapHours;
            }
          } else {
            // Ongoing period - check if it started within this period
            if (period.startTime >= startDate && period.startTime <= endDate) {
              // Session started within this period, calculate ongoing hours from period start
              const ongoingDuration = calculatePeriodDuration(period.startTime);
              periodOngoingHours += ongoingDuration;
            } else if (period.startTime < startDate) {
              // Session started before this period, calculate ongoing hours from period start
              const ongoingDuration = calculatePeriodDuration(startDate);
              periodOngoingHours += ongoingDuration;
            }
          }
        });
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
      calculateWorkingHoursForPeriod(currentMonthStart), // ✅ Use current month start (July 1st)
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
      craneDevices, // ✅ Add crane devices to response
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

// ✅ GET: Fetch crane daily movement distances
app.get("/api/crane/movement", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    const { date } = req.query;
    
    console.log('🔍 User requesting crane movement data:', { role, companyName, date });
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Use provided date or current date
    const targetDate = date || getCurrentDateString();
    
    // ✅ Get all crane logs for the target date
    const allCraneLogs = await CraneLog.find(companyFilter).lean();
    
    // ✅ Filter logs for the target date
    const dateFilteredLogs = allCraneLogs.filter(log => {
      const logDate = log.Timestamp.split(' ')[0]; // Extract date part
      return logDate === targetDate;
    });
    
    if (dateFilteredLogs.length === 0) {
      return res.json({
        date: targetDate,
        craneDistances: {},
        totalDistance: 0,
        averageDistance: 0
      });
    }
    
    // ✅ Calculate distances using location utils
    const { craneDistances, totalDistance, averageDistance } = calculateAllCraneDistances(dateFilteredLogs, targetDate);
    
    console.log(`✅ Crane movement data calculated for ${Object.keys(craneDistances).length} cranes on ${targetDate}`);
    
    res.json({
      date: targetDate,
      craneDistances,
      totalDistance,
      averageDistance
    });
    
  } catch (err) {
    console.error("❌ Crane movement fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ POST: Export comprehensive crane analysis data for PDF generation
app.post("/api/export/crane-data", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    const { selectedCranes, selectedMonths } = req.body;
    
    console.log('🔍 User requesting comprehensive export data:', { role, companyName, selectedCranes, selectedMonths });
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Filter by selected cranes if specified
    const craneFilter = selectedCranes && selectedCranes.length > 0 
      ? { DeviceID: { $in: selectedCranes } } 
      : {};
    
    // ✅ Get all crane logs with filters
    const allCraneLogs = await CraneLog.find({ ...companyFilter, ...craneFilter }).lean();
    
    // ✅ Sort logs by timestamp
    allCraneLogs.sort((a, b) => {
      const aTimestamp = parseTimestamp(a.Timestamp);
      const bTimestamp = parseTimestamp(b.Timestamp);
      if (!aTimestamp || !bTimestamp) return 0;
      return aTimestamp - bTimestamp;
    });

    // ✅ 1. Generate Start/Stop Time Sessions
    const sessionsData = generateSessionsData(allCraneLogs, selectedCranes);
    
    // ✅ 2. Generate Cumulative Statistics
    const cumulativeStats = generateCumulativeStats(allCraneLogs, selectedCranes, selectedMonths);
    console.log('🔍 Cumulative stats generated:', cumulativeStats);
    
    // ✅ 3. Generate Movement Analysis
    const movementAnalysis = generateMovementAnalysis(allCraneLogs, selectedCranes, selectedMonths);
    
    // ✅ 4. Generate Monthly Movement Data
    const monthlyMovementData = generateMonthlyMovementData(allCraneLogs, selectedCranes, selectedMonths);
    
    console.log(`✅ Comprehensive export data prepared: ${sessionsData.length} sessions, ${Object.keys(cumulativeStats).length} stats`);
    
    res.json({
      success: true,
      sessionsData,
      cumulativeStats,
      movementAnalysis,
      monthlyMovementData,
      summary: {
        totalCranes: selectedCranes ? selectedCranes.length : 0,
        totalMonths: selectedMonths ? selectedMonths.length : 0,
        totalSessions: sessionsData.length,
        totalLogs: allCraneLogs.length
      }
    });
    
  } catch (err) {
    console.error("❌ Comprehensive export data fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Helper function to generate sessions data (start/stop times)
function generateSessionsData(allCraneLogs, selectedCranes) {
  const sessionsData = [];
  
  for (const craneId of selectedCranes) {
    const craneLogs = allCraneLogs.filter(log => log.DeviceID === craneId);
    
    if (craneLogs.length === 0) continue;
    
    // Calculate consecutive periods
    const workingPeriods = calculateConsecutivePeriods(craneLogs, 'working');
    const maintenancePeriods = calculateConsecutivePeriods(craneLogs, 'maintenance');
    
    // Add working sessions
    workingPeriods.forEach(period => {
      if (!period.isOngoing) {
        sessionsData.push({
          craneId,
          sessionType: 'Working',
          startTime: period.startTimestamp,
          endTime: period.endTimestamp,
          duration: period.duration,
          startLocation: {
            lat: period.startLocation?.lat || 'N/A',
            lon: period.startLocation?.lon || 'N/A'
          },
          endLocation: {
            lat: period.endLocation?.lat || 'N/A',
            lon: period.endLocation?.lon || 'N/A'
          }
        });
      }
    });
    
    // Add maintenance sessions
    maintenancePeriods.forEach(period => {
      if (!period.isOngoing) {
        sessionsData.push({
          craneId,
          sessionType: 'Maintenance',
          startTime: period.startTimestamp,
          endTime: period.endTimestamp,
          duration: period.duration,
          startLocation: {
            lat: period.startLocation?.lat || 'N/A',
            lon: period.startLocation?.lon || 'N/A'
          },
          endLocation: {
            lat: period.endLocation?.lat || 'N/A',
            lon: period.endLocation?.lon || 'N/A'
          }
        });
      }
    });
  }
  
  return sessionsData;
}

// ✅ Helper function to generate cumulative statistics
function generateCumulativeStats(allCraneLogs, selectedCranes, selectedMonths) {
  const stats = {
    overall: { 
      working: 0, 
      workingCompleted: 0, 
      workingOngoing: 0,
      idle: 0, 
      maintenance: 0, 
      maintenanceCompleted: 0,
      maintenanceOngoing: 0,
      total: 0 
    },
    byCrane: {},
    byPeriod: {
      daily: {},
      monthly: {},
      yearly: {}
    }
  };
  
  for (const craneId of selectedCranes) {
    const craneLogs = allCraneLogs.filter(log => log.DeviceID === craneId);
    
    if (craneLogs.length === 0) continue;
    
    // Calculate periods for this crane
    const workingPeriods = calculateConsecutivePeriods(craneLogs, 'working');
    const maintenancePeriods = calculateConsecutivePeriods(craneLogs, 'maintenance');
    
    let craneWorkingCompleted = 0;
    let craneWorkingOngoing = 0;
    let craneMaintenanceCompleted = 0;
    let craneMaintenanceOngoing = 0;
    
    // Sum up working hours (separate completed vs ongoing)
    console.log(`🔍 Processing ${workingPeriods.length} working periods for ${craneId}:`, workingPeriods);
    workingPeriods.forEach(period => {
      if (period.isOngoing) {
        craneWorkingOngoing += period.duration;
        console.log(`  ✅ Ongoing period: ${period.duration}h`);
      } else {
        craneWorkingCompleted += period.duration;
        console.log(`  ✅ Completed period: ${period.duration}h`);
      }
    });
    
    // Sum up maintenance hours (separate completed vs ongoing)
    maintenancePeriods.forEach(period => {
      if (period.isOngoing) {
        craneMaintenanceOngoing += period.duration;
      } else {
        craneMaintenanceCompleted += period.duration;
      }
    });
    
    const totalWorking = craneWorkingCompleted + craneWorkingOngoing;
    const totalMaintenance = craneMaintenanceCompleted + craneMaintenanceOngoing;
    
    // Calculate idle time (assuming 24 hours per day for the period)
    const totalDays = selectedMonths.length * 30; // Approximate
    const totalHours = totalDays * 24;
    const craneIdle = totalHours - totalWorking - totalMaintenance;
    
    // Store crane stats
    stats.byCrane[craneId] = {
      working: Math.round(totalWorking * 100) / 100,
      workingCompleted: Math.round(craneWorkingCompleted * 100) / 100,
      workingOngoing: Math.round(craneWorkingOngoing * 100) / 100,
      idle: Math.round(craneIdle * 100) / 100,
      maintenance: Math.round(totalMaintenance * 100) / 100,
      maintenanceCompleted: Math.round(craneMaintenanceCompleted * 100) / 100,
      maintenanceOngoing: Math.round(craneMaintenanceOngoing * 100) / 100,
      total: Math.round((totalWorking + craneIdle + totalMaintenance) * 100) / 100
    };
    
    // Add to overall stats
    stats.overall.working += totalWorking;
    stats.overall.workingCompleted += craneWorkingCompleted;
    stats.overall.workingOngoing += craneWorkingOngoing;
    stats.overall.idle += craneIdle;
    stats.overall.maintenance += totalMaintenance;
    stats.overall.maintenanceCompleted += craneMaintenanceCompleted;
    stats.overall.maintenanceOngoing += craneMaintenanceOngoing;
  }
  
  stats.overall.total = stats.overall.working + stats.overall.idle + stats.overall.maintenance;
  
  return stats;
}

// ✅ Helper function to generate movement analysis
function generateMovementAnalysis(allCraneLogs, selectedCranes, selectedMonths) {
  const movementData = {
    byCrane: {},
    byPeriod: {
      daily: {},
      weekly: {},
      monthly: {}
    }
  };
  
  for (const craneId of selectedCranes) {
    const craneLogs = allCraneLogs.filter(log => log.DeviceID === craneId);
    
    if (craneLogs.length === 0) continue;
    
    // Calculate total distance for this crane
    let totalDistance = 0;
    const movements = [];
    
    for (let i = 1; i < craneLogs.length; i++) {
      const prevLog = craneLogs[i - 1];
      const currLog = craneLogs[i];
      
      if (validateGPSData(prevLog.Latitude, prevLog.Longitude) && 
          validateGPSData(currLog.Latitude, currLog.Longitude)) {
        
        const distance = calculateDistance(
          parseFloat(prevLog.Latitude), 
          parseFloat(prevLog.Longitude),
          parseFloat(currLog.Latitude), 
          parseFloat(currLog.Longitude)
        );
        
        totalDistance += distance;
        
        movements.push({
          from: {
            lat: prevLog.Latitude,
            lon: prevLog.Longitude,
            timestamp: prevLog.Timestamp
          },
          to: {
            lat: currLog.Latitude,
            lon: currLog.Longitude,
            timestamp: currLog.Timestamp
          },
          distance: Math.round(distance * 100) / 100
        });
      }
    }
    
    movementData.byCrane[craneId] = {
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalMovements: movements.length,
      averageDistancePerMovement: movements.length > 0 ? Math.round((totalDistance / movements.length) * 100) / 100 : 0,
      movements: movements
    };
  }
  
  return movementData;
}

// ✅ Helper function to generate monthly movement data
function generateMonthlyMovementData(allCraneLogs, selectedCranes, selectedMonths) {
  const monthlyData = {};
  
  for (const monthStr of selectedMonths) {
    try {
      const date = new Date(monthStr + ' 1, 2025');
      const targetDate = date.toLocaleDateString('en-GB');
      
      // Filter logs for this month
      const monthLogs = allCraneLogs.filter(log => {
        const logDate = log.Timestamp.split(' ')[0];
        return logDate === targetDate;
      });
      
      if (monthLogs.length > 0) {
        // Calculate distances for this month
        const { craneDistances, totalDistance, averageDistance } = calculateAllCraneDistances(monthLogs, targetDate);
        
        monthlyData[monthStr] = {
          craneDistances,
          totalDistance,
          averageDistance,
          totalLogs: monthLogs.length
        };
      }
    } catch (err) {
      console.error(`❌ Error processing month ${monthStr}:`, err);
    }
  }
  
  return monthlyData;
}

// ✅ GET: Fetch crane logs for export functionality
app.get("/api/crane/logs", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    
    console.log('🔍 User requesting crane logs for export:', { role, companyName });
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Get all crane logs for this company
    const craneLogs = await CraneLog.find(companyFilter).lean();
    
    console.log(`✅ Crane logs fetched: ${craneLogs.length} records`);
    
    res.json({
      success: true,
      logs: craneLogs,
      totalLogs: craneLogs.length
    });
    
  } catch (err) {
    console.error("❌ Crane logs fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ GET: Fetch available months with data for specific cranes
app.get("/api/crane/available-months", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    const { cranes } = req.query; // Comma-separated crane IDs
    
    console.log('🔍 User requesting available months:', { role, companyName, cranes });
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Filter by selected cranes if specified
    const craneFilter = cranes && cranes.length > 0 
      ? { DeviceID: { $in: cranes.split(',') } } 
      : {};
    
    // ✅ Get crane logs with filters
    const craneLogs = await CraneLog.find({ ...companyFilter, ...craneFilter }).lean();
    
    // ✅ Extract unique months from logs
    const monthSet = new Set();
    
    craneLogs.forEach(log => {
      try {
        const [datePart] = log.Timestamp.split(' ');
        const [day, month, year] = datePart.split('/').map(Number);
        const date = new Date(year, month - 1, day);
        const monthYear = date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long' 
        });
        monthSet.add(monthYear);
      } catch (err) {
        console.error('❌ Error parsing timestamp:', log.Timestamp);
      }
    });
    
    // ✅ Convert to sorted array
    const availableMonths = Array.from(monthSet).sort((a, b) => {
      const dateA = new Date(a + ' 1, 2025');
      const dateB = new Date(b + ' 1, 2025');
      return dateA - dateB;
    });
    
    console.log(`✅ Available months found: ${availableMonths.length} months`);
    
    res.json({
      success: true,
      availableMonths,
      totalMonths: availableMonths.length
    });
    
  } catch (err) {
    console.error("❌ Available months fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ GET: Fetch monthly crane statistics for line chart (last 6 months)
app.get("/api/crane/monthly-stats", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    
    console.log('🔍 User requesting monthly crane stats:', { role, companyName });
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Get all crane devices for this company
    const craneDevices = await CraneLog.distinct("DeviceID", companyFilter);
    
    if (craneDevices.length === 0) {
      return res.json({ monthlyData: [] });
    }

    // ✅ Calculate last 6 months data
    const now = getCurrentTimeInIST();
    const monthlyData = [];
    
    // ✅ Generate last 6 months (including current month)
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = monthDate.toLocaleString('default', { month: 'short' });
      const monthYear = `${monthName} ${monthDate.getFullYear()}`;
      
      // ✅ Calculate start and end of month
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);
      
      let monthUsageHours = 0;
      let monthMaintenanceHours = 0;

      // ✅ Calculate for each crane device
      for (const deviceId of craneDevices) {
        const deviceFilter = { ...companyFilter, DeviceID: deviceId };
        
        // Get all logs for this device
        const deviceLogs = await CraneLog.find(deviceFilter).lean();
        
        // Filter logs within this month
        const monthLogs = deviceLogs.filter(log => {
          try {
            const [datePart, timePart] = log.Timestamp.split(' ');
            const [day, month, year] = datePart.split('/').map(Number);
            const [hour, minute, second] = timePart.split(':').map(Number);
            const logTime = new Date(year, month - 1, day, hour, minute, second);
            return logTime >= monthStart && logTime <= monthEnd;
          } catch (err) {
            console.error(`❌ Error parsing timestamp for monthly filtering:`, err);
            return false;
          }
        });

        if (monthLogs.length === 0) continue;

        // Sort by timestamp
        monthLogs.sort((a, b) => {
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

        // ✅ NEW: Calculate usage hours using periodic data logic
        const workingPeriods = calculateConsecutivePeriods(monthLogs, 'working');
        
        for (const period of workingPeriods) {
          if (period.isOngoing) {
            // For ongoing sessions, calculate from period start to current time
            const periodStart = period.startTime;
            const currentTime = getCurrentTimeInIST();
            
            // If ongoing session started before this month, count from month start
            const effectiveStart = periodStart < monthStart ? monthStart : periodStart;
            const duration = calculatePeriodDuration(effectiveStart, currentTime, true);
            monthUsageHours += duration;
          } else {
            // For completed sessions, calculate from period start to period end
            const periodStart = period.startTime;
            const periodEnd = period.endTime;
            
            // If session started before this month, count from month start
            const effectiveStart = periodStart < monthStart ? monthStart : periodStart;
            // If session ended after this month, count until month end
            const effectiveEnd = periodEnd > monthEnd ? monthEnd : periodEnd;
            
            const duration = calculatePeriodDuration(effectiveStart, effectiveEnd, false);
            monthUsageHours += duration;
          }
        }

        // ✅ NEW: Calculate maintenance hours using periodic data logic
        const maintenancePeriods = calculateConsecutivePeriods(monthLogs, 'maintenance');
        
        for (const period of maintenancePeriods) {
          if (period.isOngoing) {
            // For ongoing sessions, calculate from period start to current time
            const periodStart = period.startTime;
            const currentTime = getCurrentTimeInIST();
            
            // If ongoing session started before this month, count from month start
            const effectiveStart = periodStart < monthStart ? monthStart : periodStart;
            const duration = calculatePeriodDuration(effectiveStart, currentTime, true);
            monthMaintenanceHours += duration;
          } else {
            // For completed sessions, calculate from period start to period end
            const periodStart = period.startTime;
            const periodEnd = period.endTime;
            
            // If session started before this month, count from month start
            const effectiveStart = periodStart < monthStart ? monthStart : periodStart;
            // If session ended after this month, count until month end
            const effectiveEnd = periodEnd > monthEnd ? monthEnd : periodEnd;
            
            const duration = calculatePeriodDuration(effectiveStart, effectiveEnd, false);
            monthMaintenanceHours += duration;
          }
        }

        // ✅ REMOVED: Old ongoing session logic - now handled by calculateConsecutivePeriods()
      }

      monthlyData.push({
        month: monthYear,
        usageHours: Math.round(monthUsageHours * 100) / 100,
        maintenanceHours: Math.round(monthMaintenanceHours * 100) / 100
      });
    }

    console.log(`✅ Monthly crane stats calculated for ${monthlyData.length} months`);
    
    res.json({ monthlyData });

  } catch (err) {
    console.error("❌ Monthly crane stats fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ GET: Fetch individual crane statistics for bar chart (last 6 months)
app.get("/api/crane/crane-stats", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    
    console.log('🔍 User requesting individual crane stats:', { role, companyName });
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Get all crane devices for this company
    const craneDevices = await CraneLog.distinct("DeviceID", companyFilter);
    
    if (craneDevices.length === 0) {
      return res.json({ craneData: [] });
    }

    // ✅ Calculate last 6 months period
    const now = getCurrentTimeInIST();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const periodStart = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    // ✅ Calculate total period hours (6 months)
    const totalPeriodHours = (periodEnd - periodStart) / (1000 * 60 * 60);
    
    const craneData = [];

    // ✅ Calculate stats for each crane
    for (const deviceId of craneDevices) {
      const deviceFilter = { ...companyFilter, DeviceID: deviceId };
      
      // Get all logs for this device
      const deviceLogs = await CraneLog.find(deviceFilter).lean();
      
      // Filter logs within the 6-month period
      const periodLogs = deviceLogs.filter(log => {
        try {
          const [datePart, timePart] = log.Timestamp.split(' ');
          const [day, month, year] = datePart.split('/').map(Number);
          const [hour, minute, second] = timePart.split(':').map(Number);
          const logTime = new Date(year, month - 1, day, hour, minute, second);
          return logTime >= periodStart && logTime <= periodEnd;
        } catch (err) {
          console.error(`❌ Error parsing timestamp for crane stats filtering:`, err);
          return false;
        }
      });

      if (periodLogs.length === 0) {
        // ✅ No data for this crane in the period
        craneData.push({
          craneId: deviceId,
          workingHours: 0,
          inactiveHours: Math.round(totalPeriodHours * 100) / 100,
          maintenanceHours: 0
        });
        continue;
      }

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

      let workingHours = 0;
      let maintenanceHours = 0;

      // ✅ NEW: Calculate working hours using periodic data logic
      const workingPeriods = calculateConsecutivePeriods(periodLogs, 'working');
      
      for (const period of workingPeriods) {
        if (period.isOngoing) {
          // For ongoing sessions, calculate from period start to current time
          const periodStart = period.startTime;
          const currentTime = getCurrentTimeInIST();
          
          // If ongoing session started before this period, count from period start
          const effectiveStart = periodStart < periodStart ? periodStart : periodStart;
          const duration = calculatePeriodDuration(effectiveStart, currentTime, true);
          workingHours += duration;
        } else {
          // For completed sessions, calculate from period start to period end
          const periodStart = period.startTime;
          const periodEnd = period.endTime;
          
          const duration = calculatePeriodDuration(periodStart, periodEnd, false);
          workingHours += duration;
        }
      }

      // ✅ NEW: Calculate maintenance hours using periodic data logic
      const maintenancePeriods = calculateConsecutivePeriods(periodLogs, 'maintenance');
      
      for (const period of maintenancePeriods) {
        if (period.isOngoing) {
          // For ongoing sessions, calculate from period start to current time
          const periodStart = period.startTime;
          const currentTime = getCurrentTimeInIST();
          
          const duration = calculatePeriodDuration(periodStart, currentTime, true);
          maintenanceHours += duration;
        } else {
          // For completed sessions, calculate from period start to period end
          const periodStart = period.startTime;
          const periodEnd = period.endTime;
          
          const duration = calculatePeriodDuration(periodStart, periodEnd, false);
          maintenanceHours += duration;
        }
      }

      // ✅ REMOVED: Old ongoing session logic - now handled by calculateConsecutivePeriods()

      // ✅ Calculate inactive hours
      const inactiveHours = Math.max(0, totalPeriodHours - workingHours - maintenanceHours);

      craneData.push({
        craneId: deviceId,
        workingHours: Math.round(workingHours * 100) / 100,
        inactiveHours: Math.round(inactiveHours * 100) / 100,
        maintenanceHours: Math.round(maintenanceHours * 100) / 100
      });
    }

    console.log(`✅ Individual crane stats calculated for ${craneData.length} cranes`);
    
    res.json({ craneData });

  } catch (err) {
    console.error("❌ Individual crane stats fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ GET: Fetch previous month performance stats
app.get("/api/crane/previous-month-stats", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    const { month, year } = req.query; // Optional: month (0-11), year
    
    console.log('🔍 User requesting previous month stats:', { role, companyName, month, year });
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Get all crane devices for this company
    const craneDevices = await CraneLog.distinct("DeviceID", companyFilter);
    
    if (craneDevices.length === 0) {
      return res.json({ 
        monthName: "No Data",
        workingHours: 0,
        maintenanceHours: 0,
        idleHours: 0,
        utilizationRate: 0,
        totalHours: 0
      });
    }

    // ✅ Calculate target month (default: previous month)
    const now = getCurrentTimeInIST();
    let targetMonth, targetYear;
    
    if (month !== undefined && year !== undefined) {
      // Use provided month/year
      targetMonth = parseInt(month);
      targetYear = parseInt(year);
    } else {
      // Default to previous month
      targetMonth = now.getMonth() - 1;
      targetYear = now.getFullYear();
      
      // Handle January case (previous month would be December of previous year)
      if (targetMonth < 0) {
        targetMonth = 11; // December
        targetYear = now.getFullYear() - 1;
      }
    }
    
    // ✅ Calculate month period
    const monthStart = new Date(targetYear, targetMonth, 1);
    const monthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
    const monthName = monthStart.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    // ✅ Calculate total hours in the month
    const totalHours = (monthEnd - monthStart) / (1000 * 60 * 60);
    
    let totalWorkingHours = 0;
    let totalMaintenanceHours = 0;

    // ✅ Calculate for each crane device
    for (const deviceId of craneDevices) {
      const deviceFilter = { ...companyFilter, DeviceID: deviceId };
      
      // Get all logs for this device
      const deviceLogs = await CraneLog.find(deviceFilter).lean();
      
      // Filter logs within this month
      const monthLogs = deviceLogs.filter(log => {
        try {
          const [datePart, timePart] = log.Timestamp.split(' ');
          const [day, month, year] = datePart.split('/').map(Number);
          const [hour, minute, second] = timePart.split(':').map(Number);
          const logTime = new Date(year, month - 1, day, hour, minute, second);
          return logTime >= monthStart && logTime <= monthEnd;
        } catch (err) {
          console.error(`❌ Error parsing timestamp for previous month filtering:`, err);
          return false;
        }
      });

      if (monthLogs.length === 0) continue;

      // Sort by timestamp
      monthLogs.sort((a, b) => {
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

      // ✅ NEW: Calculate working hours using periodic data logic
      const workingPeriods = calculateConsecutivePeriods(monthLogs, 'working');
      
      for (const period of workingPeriods) {
        if (period.isOngoing) {
          // For ongoing sessions, calculate from period start to current time
          const periodStart = period.startTime;
          const currentTime = getCurrentTimeInIST();
          
          // If ongoing session started before this month, count from month start
          const effectiveStart = periodStart < monthStart ? monthStart : periodStart;
          const duration = calculatePeriodDuration(effectiveStart, currentTime, true);
          totalWorkingHours += duration;
        } else {
          // For completed sessions, calculate from period start to period end
          const periodStart = period.startTime;
          const periodEnd = period.endTime;
          
          // If session started before this month, count from month start
          const effectiveStart = periodStart < monthStart ? monthStart : periodStart;
          // If session ended after this month, count until month end
          const effectiveEnd = periodEnd > monthEnd ? monthEnd : periodEnd;
          
          const duration = calculatePeriodDuration(effectiveStart, effectiveEnd, false);
          totalWorkingHours += duration;
        }
      }

      // ✅ NEW: Calculate maintenance hours using periodic data logic
      const maintenancePeriods = calculateConsecutivePeriods(monthLogs, 'maintenance');
      
      for (const period of maintenancePeriods) {
        if (period.isOngoing) {
          // For ongoing sessions, calculate from period start to current time
          const periodStart = period.startTime;
          const currentTime = getCurrentTimeInIST();
          
          // If ongoing session started before this month, count from month start
          const effectiveStart = periodStart < monthStart ? monthStart : periodStart;
          const duration = calculatePeriodDuration(effectiveStart, currentTime, true);
          totalMaintenanceHours += duration;
        } else {
          // For completed sessions, calculate from period start to period end
          const periodStart = period.startTime;
          const periodEnd = period.endTime;
          
          // If session started before this month, count from month start
          const effectiveStart = periodStart < monthStart ? monthStart : periodStart;
          // If session ended after this month, count until month end
          const effectiveEnd = periodEnd > monthEnd ? monthEnd : periodEnd;
          
          const duration = calculatePeriodDuration(effectiveStart, effectiveEnd, false);
          totalMaintenanceHours += duration;
        }
      }
    }

    // ✅ Calculate idle hours and utilization rate
    const totalIdleHours = Math.max(0, totalHours - totalWorkingHours - totalMaintenanceHours);
    const utilizationRate = totalHours > 0 ? (totalWorkingHours / totalHours) * 100 : 0;

    console.log(`✅ Previous month stats calculated for ${monthName}: Working: ${totalWorkingHours.toFixed(2)}h, Maintenance: ${totalMaintenanceHours.toFixed(2)}h, Idle: ${totalIdleHours.toFixed(2)}h`);

    res.json({
      monthName,
      workingHours: Math.round(totalWorkingHours * 100) / 100,
      maintenanceHours: Math.round(totalMaintenanceHours * 100) / 100,
      idleHours: Math.round(totalIdleHours * 100) / 100,
      utilizationRate: Math.round(utilizationRate * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100
    });

  } catch (err) {
    console.error("❌ Previous month stats fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ GET: Fetch maintenance updates for all cranes
app.get("/api/crane/maintenance-updates", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    const { month, year } = req.query; // Optional: month (0-11), year
    
    console.log('🔍 User requesting maintenance updates:', { role, companyName, month, year });
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Get all crane devices for this company
    const craneDevices = await CraneLog.distinct("DeviceID", companyFilter);
    
    if (craneDevices.length === 0) {
      return res.json({ 
        monthName: "No Data",
        summary: {
          totalMaintenanceHours: 0,
          totalSessions: 0,
          averageDuration: 0
        },
        craneData: []
      });
    }

    // ✅ Calculate target month (default: current month)
    const now = getCurrentTimeInIST();
    let targetMonth, targetYear;
    
    if (month !== undefined && year !== undefined) {
      // Use provided month/year
      targetMonth = parseInt(month);
      targetYear = parseInt(year);
    } else {
      // Default to current month
      targetMonth = now.getMonth();
      targetYear = now.getFullYear();
    }
    
    // ✅ Calculate month period
    const monthStart = new Date(targetYear, targetMonth, 1);
    const monthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
    const monthName = monthStart.toLocaleString('default', { month: 'long', year: 'numeric' });
    
    let totalMaintenanceHours = 0;
    let totalSessions = 0;
    const craneData = [];

    // ✅ Calculate for each crane device
    for (const deviceId of craneDevices) {
      const deviceFilter = { ...companyFilter, DeviceID: deviceId };
      
      // Get all logs for this device
      const deviceLogs = await CraneLog.find(deviceFilter).lean();
      
      // Filter logs within this month
      const monthLogs = deviceLogs.filter(log => {
        try {
          const [datePart, timePart] = log.Timestamp.split(' ');
          const [day, month, year] = datePart.split('/').map(Number);
          const [hour, minute, second] = timePart.split(':').map(Number);
          const logTime = new Date(year, month - 1, day, hour, minute, second);
          return logTime >= monthStart && logTime <= monthEnd;
  } catch (err) {
          console.error(`❌ Error parsing timestamp for maintenance filtering:`, err);
          return false;
        }
      });

      if (monthLogs.length === 0) continue;

      // Sort by timestamp
      monthLogs.sort((a, b) => {
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

      let craneMaintenanceHours = 0;
      let craneSessions = 0;
      const maintenanceSessions = [];

      // ✅ Find maintenance sessions (DigitalInput2 = "1" sessions)
      console.log(`🔍 Checking ${deviceId} for maintenance sessions in ${monthName}. Total logs: ${monthLogs.length}`);
      
      // Debug: Show all logs for this crane in this month
      console.log(`🔍 All logs for ${deviceId} in ${monthName}:`);
      monthLogs.forEach((log, index) => {
        console.log(`  ${index}: ${log.Timestamp} - DigitalInput1: ${log.DigitalInput1}, DigitalInput2: ${log.DigitalInput2}`);
      });
      
      for (let i = 0; i < monthLogs.length - 1; i++) {
        const currentLog = monthLogs[i];
        const nextLog = monthLogs[i + 1];

        // Find maintenance start (DigitalInput2 changes from "0" to "1")
        if (currentLog.DigitalInput2 === "0" && nextLog.DigitalInput2 === "1") {
          console.log(`🔍 Found maintenance start for ${deviceId}: ${currentLog.Timestamp} (0) -> ${nextLog.Timestamp} (1)`);
          const sessionStart = nextLog.Timestamp; // ✅ Use the timestamp when maintenance actually started
          let sessionEnd = null;
          let sessionDuration = 0;
          let isOngoing = false;

          // Find maintenance end (DigitalInput2 changes from "1" to "0")
          for (let j = i + 1; j < monthLogs.length - 1; j++) {
            const checkLog = monthLogs[j];
            const nextCheckLog = monthLogs[j + 1];
            
            if (checkLog.DigitalInput2 === "1" && nextCheckLog.DigitalInput2 === "0") {
              sessionEnd = nextCheckLog.Timestamp; // ✅ Use the timestamp when maintenance actually ended
              
              // Calculate duration
              try {
                const [startDatePart, startTimePart] = sessionStart.split(' ');
                const [startDay, startMonth, startYear] = startDatePart.split('/').map(Number);
                const [startHour, startMinute, startSecond] = startTimePart.split(':').map(Number);
                const startTimeIST = new Date(startYear, startMonth - 1, startDay, startHour, startMinute, startSecond);
                
                const [endDatePart, endTimePart] = sessionEnd.split(' ');
                const [endDay, endMonth, endYear] = endDatePart.split('/').map(Number);
                const [endHour, endMinute, endSecond] = endTimePart.split(':').map(Number);
                const endTimeIST = new Date(endYear, endMonth - 1, endDay, endHour, endMinute, endSecond);
                
                sessionDuration = (endTimeIST - startTimeIST) / (1000 * 60 * 60);
                craneMaintenanceHours += sessionDuration;
                craneSessions++;
                console.log(`✅ Found maintenance session for ${deviceId}: ${sessionStart} to ${sessionEnd} = ${sessionDuration.toFixed(2)}h`);
              } catch (err) {
                console.error(`❌ Error calculating maintenance session duration:`, err);
              }
              break;
            }
          }

          // If no end found, it's ongoing
          if (!sessionEnd) {
            sessionEnd = "Ongoing";
            isOngoing = true;
            
            // Calculate ongoing duration
            try {
              const [startDatePart, startTimePart] = sessionStart.split(' ');
              const [startDay, startMonth, startYear] = startDatePart.split('/').map(Number);
              const [startHour, startMinute, startSecond] = startTimePart.split(':').map(Number);
              const startTimeIST = new Date(startYear, startMonth - 1, startDay, startHour, startMinute, startSecond);
              
              const currentTime = getCurrentTimeInIST();
              sessionDuration = (currentTime - startTimeIST) / (1000 * 60 * 60);
              craneMaintenanceHours += sessionDuration;
              craneSessions++;
              console.log(`✅ Found ongoing maintenance session for ${deviceId}: ${sessionStart} to ongoing = ${sessionDuration.toFixed(2)}h`);
            } catch (err) {
              console.error(`❌ Error calculating ongoing maintenance duration:`, err);
            }
          }

          maintenanceSessions.push({
            startTime: sessionStart,
            endTime: sessionEnd,
            duration: Math.round(sessionDuration * 100) / 100,
            isOngoing
          });
        }
      }

      // ✅ Add crane data if it has maintenance sessions
      if (craneSessions > 0) {
        const averageDuration = craneSessions > 0 ? craneMaintenanceHours / craneSessions : 0;
        
        craneData.push({
          craneId: deviceId,
          totalHours: Math.round(craneMaintenanceHours * 100) / 100,
          sessions: craneSessions,
          averageDuration: Math.round(averageDuration * 100) / 100,
          maintenanceSessions
        });

        totalMaintenanceHours += craneMaintenanceHours;
        totalSessions += craneSessions;
      }
    }

    // ✅ Calculate summary
    const averageDuration = totalSessions > 0 ? totalMaintenanceHours / totalSessions : 0;

    console.log(`✅ Maintenance updates calculated for ${monthName}: Total: ${totalMaintenanceHours.toFixed(2)}h, Sessions: ${totalSessions}`);
    
    res.json({
      monthName,
      summary: {
        totalMaintenanceHours: Math.round(totalMaintenanceHours * 100) / 100,
        totalSessions,
        averageDuration: Math.round(averageDuration * 100) / 100
      },
      craneData
    });

  } catch (err) {
    console.error("❌ Maintenance updates fetch error:", err);
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
    
    if (latestLog.DigitalInput2 === "1") {
      status = "Maintenance";
      statusColor = "warning";
      isDown = true;
    } else if (latestLog.DigitalInput1 === "1") {
      status = "Operating";
      statusColor = "success";
      isOperating = true;
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
      deviceId: latestLog.DeviceID,
      digitalInput1: latestLog.DigitalInput1,
      digitalInput2: latestLog.DigitalInput2
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
    function calculateHoursForPeriod(startDate, endDate = getCurrentTimeInIST()) {
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
            const currentTime = convertISTToUTC(currentTimeIST);
            
            const [nextDatePart, nextTimePart] = nextLog.Timestamp.split(' ');
            const [nextDay, nextMonth, nextYear] = nextDatePart.split('/').map(Number);
            const [nextHour, nextMinute, nextSecond] = nextTimePart.split(':').map(Number);
            const nextTimeIST = new Date(nextYear, nextMonth - 1, nextDay, nextHour, nextMinute, nextSecond);
            const nextTime = convertISTToUTC(nextTimeIST);
            
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
          const latestTime = convertISTToUTC(latestTimeIST);
          
          const ongoingHoursDiff = (endDate - latestTime) / (1000 * 60 * 60);
          if (ongoingHoursDiff > 0 && ongoingHoursDiff < 72) { // Allow up to 3 days for ongoing sessions
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
    
    // ✅ Count completed sessions and extract operating sessions
    let completedSessions = 0;
    const operatingSessions = [];
    
    // ✅ Extract operating sessions from device logs
    for (let i = 0; i < deviceLogs.length - 1; i++) {
      const currentLog = deviceLogs[i];
      const nextLog = deviceLogs[i + 1];
      
      if (currentLog.DigitalInput1 === "1" && nextLog.DigitalInput1 === "0") {
        completedSessions++;
        
        try {
          // ✅ Calculate session duration
          const [currentDatePart, currentTimePart] = currentLog.Timestamp.split(' ');
          const [currentDay, currentMonth, currentYear] = currentDatePart.split('/').map(Number);
          const [currentHour, currentMinute, currentSecond] = currentTimePart.split(':').map(Number);
          const currentTimeIST = new Date(currentYear, currentMonth - 1, currentDay, currentHour, currentMinute, currentSecond);
          const currentTime = convertISTToUTC(currentTimeIST);
          
          const [nextDatePart, nextTimePart] = nextLog.Timestamp.split(' ');
          const [nextDay, nextMonth, nextYear] = nextDatePart.split('/').map(Number);
          const [nextHour, nextMinute, nextSecond] = nextTimePart.split(':').map(Number);
          const nextTimeIST = new Date(nextYear, nextMonth - 1, nextDay, nextHour, nextMinute, nextSecond);
          const nextTime = convertISTToUTC(nextTimeIST);
          
          const sessionHours = (nextTime - currentTime) / (1000 * 60 * 60);
          
          const session = {
            date: currentDatePart, // DD/MM/YYYY
            startTime: currentTimePart, // HH:mm:ss
            stopTime: nextTimePart, // HH:mm:ss
            totalHours: Math.round(sessionHours * 100) / 100
          };
          operatingSessions.push(session);
        } catch (err) {
          console.error(`❌ Error parsing session timestamps:`, err);
        }
      }
    }
    
    // ✅ Check for ongoing session (latest log)
    const latestLog = deviceLogs[deviceLogs.length - 1];
    if (latestLog && latestLog.DigitalInput1 === "1") {
      try {
        const [latestDatePart, latestTimePart] = latestLog.Timestamp.split(' ');
        const latestTimeIST = new Date(
          latestDatePart.split('/')[2], // year
          latestDatePart.split('/')[1] - 1, // month (0-based)
          latestDatePart.split('/')[0], // day
          latestTimePart.split(':')[0], // hour
          latestTimePart.split(':')[1], // minute
          latestTimePart.split(':')[2] // second
        );
        
        const currentTime = getCurrentTimeInIST();
        const ongoingHoursDiff = (currentTime - latestTimeIST) / (1000 * 60 * 60);
        
        if (ongoingHoursDiff > 0 && ongoingHoursDiff < 72) { // Allow up to 3 days for ongoing sessions
          const ongoingSession = {
            date: latestDatePart,
            startTime: latestTimePart,
            stopTime: "Running...",
            totalHours: Math.round(ongoingHoursDiff * 100) / 100
          };
          operatingSessions.unshift(ongoingSession); // Add to beginning
        }
      } catch (err) {
        console.error(`❌ Error calculating ongoing session:`, err);
      }
    }
    
    // ✅ Sort sessions by date (newest first)
    operatingSessions.sort((a, b) => {
      const [aDay, aMonth, aYear] = a.date.split('/').map(Number);
      const [bDay, bMonth, bYear] = b.date.split('/').map(Number);
      const aDate = new Date(aYear, aMonth - 1, aDay);
      const bDate = new Date(bYear, bMonth - 1, bDay);
      return bDate - aDate; // Newest first
    });
    
    const craneActivity = {
      todayHours: Math.round(todayHours * 100) / 100,
      weekHours: Math.round(weekHours * 100) / 100,
      monthHours: Math.round(monthHours * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
      completedSessions,
      ongoingHours: Math.round(ongoingHours * 100) / 100,
      operatingSessions: operatingSessions.slice(0, 10) // Return last 10 sessions
    };
    
    console.log(`✅ Crane ${deviceId} activity calculated:`, craneActivity);
    
    res.json(craneActivity);
    
  } catch (err) {
    console.error("❌ Crane activity fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ GET: Fetch crane chart data for individual device
app.get("/api/crane/chart", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    const { deviceId, period = '24hr' } = req.query;
    
    console.log('🔍 User requesting crane chart data:', { role, companyName, deviceId, period });
    
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
      return res.json({ labels: [], data: [] });
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
    
    // ✅ Calculate chart data based on period
    let labels = [];
    let data = [];
    
    const now = new Date();
    
    switch (period) {
      case '24hr':
        // ✅ Last 24 hours by hour
        labels = [];
        data = [];
        for (let i = 23; i >= 0; i--) {
          const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
          labels.push(hour.getHours().toString().padStart(2, '0') + ':00');
          
          // ✅ Calculate operating hours for this hour
          const hourStart = new Date(hour.getFullYear(), hour.getMonth(), hour.getDate(), hour.getHours(), 0, 0);
          const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
          
          let hourHours = 0;
          for (let j = 0; j < deviceLogs.length - 1; j++) {
            const currentLog = deviceLogs[j];
            const nextLog = deviceLogs[j + 1];
            
            if (currentLog.DigitalInput1 === "1" && nextLog.DigitalInput1 === "0") {
              try {
                const [currentDatePart, currentTimePart] = currentLog.Timestamp.split(' ');
                const [currentDay, currentMonth, currentYear] = currentDatePart.split('/').map(Number);
                const [currentHour, currentMinute, currentSecond] = currentTimePart.split(':').map(Number);
                const currentTimeIST = new Date(currentYear, currentMonth - 1, currentDay, currentHour, currentMinute, currentSecond);
                const currentTime = convertISTToUTC(currentTimeIST);
                
                const [nextDatePart, nextTimePart] = nextLog.Timestamp.split(' ');
                const [nextDay, nextMonth, nextYear] = nextDatePart.split('/').map(Number);
                const [nextHour, nextMinute, nextSecond] = nextTimePart.split(':').map(Number);
                const nextTimeIST = new Date(nextYear, nextMonth - 1, nextDay, nextHour, nextMinute, nextSecond);
                const nextTime = convertISTToUTC(nextTimeIST);
                
                // ✅ Check if session overlaps with this hour
                const sessionStart = Math.max(currentTime, hourStart);
                const sessionEnd = Math.min(nextTime, hourEnd);
                
                if (sessionStart < sessionEnd) {
                  hourHours += (sessionEnd - sessionStart) / (1000 * 60 * 60);
                }
              } catch (err) {
                console.error(`❌ Error parsing chart timestamps:`, err);
              }
            }
          }
          data.push(Math.round(hourHours * 100) / 100);
        }
        break;
        
      case 'weekly':
        // ✅ Last 7 days by day
        labels = [];
        data = [];
        for (let i = 6; i >= 0; i--) {
          const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          labels.push(day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
          
          // ✅ Calculate operating hours for this day
          const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
          const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
          
          let dayHours = 0;
          for (let j = 0; j < deviceLogs.length - 1; j++) {
            const currentLog = deviceLogs[j];
            const nextLog = deviceLogs[j + 1];
            
            if (currentLog.DigitalInput1 === "1" && nextLog.DigitalInput1 === "0") {
              try {
                const [currentDatePart, currentTimePart] = currentLog.Timestamp.split(' ');
                const [currentDay, currentMonth, currentYear] = currentDatePart.split('/').map(Number);
                const [currentHour, currentMinute, currentSecond] = currentTimePart.split(':').map(Number);
                const currentTimeIST = new Date(currentYear, currentMonth - 1, currentDay, currentHour, currentMinute, currentSecond);
                const currentTime = convertISTToUTC(currentTimeIST);
                
                const [nextDatePart, nextTimePart] = nextLog.Timestamp.split(' ');
                const [nextDay, nextMonth, nextYear] = nextDatePart.split('/').map(Number);
                const [nextHour, nextMinute, nextSecond] = nextTimePart.split(':').map(Number);
                const nextTimeIST = new Date(nextYear, nextMonth - 1, nextDay, nextHour, nextMinute, nextSecond);
                const nextTime = convertISTToUTC(nextTimeIST);
                
                // ✅ Check if session overlaps with this day
                const sessionStart = Math.max(currentTime, dayStart);
                const sessionEnd = Math.min(nextTime, dayEnd);
                
                if (sessionStart < sessionEnd) {
                  dayHours += (sessionEnd - sessionStart) / (1000 * 60 * 60);
                }
              } catch (err) {
                console.error(`❌ Error parsing chart timestamps:`, err);
              }
            }
          }
          data.push(Math.round(dayHours * 100) / 100);
        }
        break;
        
      case 'monthly':
        // ✅ Last 30 days by day
        labels = [];
        data = [];
        for (let i = 29; i >= 0; i--) {
          const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          labels.push(day.getDate().toString());
          
          // ✅ Calculate operating hours for this day (same logic as weekly)
          const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
          const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
          
          let dayHours = 0;
          for (let j = 0; j < deviceLogs.length - 1; j++) {
            const currentLog = deviceLogs[j];
            const nextLog = deviceLogs[j + 1];
            
            if (currentLog.DigitalInput1 === "1" && nextLog.DigitalInput1 === "0") {
              try {
                const [currentDatePart, currentTimePart] = currentLog.Timestamp.split(' ');
                const [currentDay, currentMonth, currentYear] = currentDatePart.split('/').map(Number);
                const [currentHour, currentMinute, currentSecond] = currentTimePart.split(':').map(Number);
                const currentTimeIST = new Date(currentYear, currentMonth - 1, currentDay, currentHour, currentMinute, currentSecond);
                const currentTime = convertISTToUTC(currentTimeIST);
                
                const [nextDatePart, nextTimePart] = nextLog.Timestamp.split(' ');
                const [nextDay, nextMonth, nextYear] = nextDatePart.split('/').map(Number);
                const [nextHour, nextMinute, nextSecond] = nextTimePart.split(':').map(Number);
                const nextTimeIST = new Date(nextYear, nextMonth - 1, nextDay, nextHour, nextMinute, nextSecond);
                const nextTime = convertISTToUTC(nextTimeIST);
                
                const sessionStart = Math.max(currentTime, dayStart);
                const sessionEnd = Math.min(nextTime, dayEnd);
                
                if (sessionStart < sessionEnd) {
                  dayHours += (sessionEnd - sessionStart) / (1000 * 60 * 60);
                }
              } catch (err) {
                console.error(`❌ Error parsing chart timestamps:`, err);
              }
            }
          }
          data.push(Math.round(dayHours * 100) / 100);
        }
        break;
        
      case 'yearly':
        // ✅ Last 12 months by month
        labels = [];
        data = [];
        for (let i = 11; i >= 0; i--) {
          const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
          labels.push(month.toLocaleDateString('en-US', { month: 'short' }));
          
          // ✅ Calculate operating hours for this month
          const monthStart = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0);
          const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
          
          let monthHours = 0;
          for (let j = 0; j < deviceLogs.length - 1; j++) {
            const currentLog = deviceLogs[j];
            const nextLog = deviceLogs[j + 1];
            
            if (currentLog.DigitalInput1 === "1" && nextLog.DigitalInput1 === "0") {
              try {
                const [currentDatePart, currentTimePart] = currentLog.Timestamp.split(' ');
                const [currentDay, currentMonth, currentYear] = currentDatePart.split('/').map(Number);
                const [currentHour, currentMinute, currentSecond] = currentTimePart.split(':').map(Number);
                const currentTimeIST = new Date(currentYear, currentMonth - 1, currentDay, currentHour, currentMinute, currentSecond);
                const currentTime = convertISTToUTC(currentTimeIST);
                
                const [nextDatePart, nextTimePart] = nextLog.Timestamp.split(' ');
                const [nextDay, nextMonth, nextYear] = nextDatePart.split('/').map(Number);
                const [nextHour, nextMinute, nextSecond] = nextTimePart.split(':').map(Number);
                const nextTimeIST = new Date(nextYear, nextMonth - 1, nextDay, nextHour, nextMinute, nextSecond);
                const nextTime = convertISTToUTC(nextTimeIST);
                
                const sessionStart = Math.max(currentTime, monthStart);
                const sessionEnd = Math.min(nextTime, monthEnd);
                
                if (sessionStart < sessionEnd) {
                  monthHours += (sessionEnd - sessionStart) / (1000 * 60 * 60);
                }
              } catch (err) {
                console.error(`❌ Error parsing chart timestamps:`, err);
              }
            }
          }
          data.push(Math.round(monthHours * 100) / 100);
        }
        break;
        
      default:
        labels = [];
        data = [];
    }
    
    console.log(`✅ Chart data for crane ${deviceId} (${period}):`, { labels: labels.length, data: data.length });
    
    res.json({ labels, data });
    
  } catch (err) {
    console.error("❌ Crane chart fetch error:", err);
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
