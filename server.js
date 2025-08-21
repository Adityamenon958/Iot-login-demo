require('dotenv').config();

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
const CompanyDashboardAccess = require("./backend/models/CompanyDashboardAccess");
const { calculateAllCraneDistances, getCurrentDateString, validateGPSData, calculateDistance } = require("./backend/utils/locationUtils");

// ✅ FIXED: Environment-based timezone helper function - now consistent across environments
function getCurrentTimeInIST() {
  // ✅ FIXED: Use consistent time handling across all environments
  // No more environment-specific timezone conversions
  const now = new Date();
  return now;
}

// ✅ FIXED: Environment-based timestamp conversion helper - now consistent across environments
function convertISTToUTC(istTime) {
  // ✅ FIXED: Use consistent time handling across all environments
  // No more environment-specific timezone conversions
  return istTime;
}

// ✅ FIXED: Helper function for consistent date boundary handling
function getDateBoundary(date, isStart = true) {
  let result;
  if (isStart) {
    // ✅ Start of day: 00:00:00 IST - Direct IST date creation
    result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  } else {
    // ✅ End of day: 23:59:59 IST - Direct IST date creation
    result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
  }
  return result;
}

// ✅ FIXED: Helper function to parse timestamp string to Date object consistently across environments
function parseTimestamp(timestampStr) {
  try {
    const [datePart, timePart] = timestampStr.split(' ');
    const [day, month, year] = datePart.split('/').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);
    
    // ✅ FIXED: Use consistent timestamp creation across all environments
    // No more environment-specific timezone conversions
    const result = new Date(year, month - 1, day, hour, minute, second);
    return result;
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
    // ✅ FIX: Don't calculate duration here - it will be calculated later using correct timestamps
    // The issue is that currentPeriod.startTime was calculated with old parseTimestamp
    currentPeriod.duration = 0; // Will be recalculated later
    periods.push(currentPeriod);
  }
  
  return periods;
}

// ✅ NEW: Helper function to calculate period duration including ongoing sessions
function calculatePeriodDuration(startTime, endTime = null, isOngoing = false) {
  if (!startTime) return 0;
  
  const end = endTime || getCurrentTimeInIST();
  const duration = (end - startTime) / (1000 * 60 * 60);
  
  // ✅ Calculate duration for ongoing sessions
  
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
  // MongoDB connected successfully
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
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyName: user.companyName,
      contactInfo: user.contactInfo,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionStart: user.subscriptionStart,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
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
    const { companyName, uid, deviceId, deviceType } = req.body;

    if (!companyName || !uid || !deviceId || !deviceType) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const newDevice = new Device({ companyName, uid, deviceId, deviceType });

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

// ✅ Update device (superadmin: any; admin: only within own company)
app.put('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const { role: actorRole, companyName: actorCompany } = req.user || {};
    if (!actorRole) return res.status(401).json({ message: 'Unauthorized' });

    const targetDevice = await Device.findById(req.params.id);
    if (!targetDevice) return res.status(404).json({ message: 'Device not found' });

    if (actorRole !== 'superadmin') {
      if (actorRole !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      if (targetDevice.companyName !== actorCompany) {
        return res.status(403).json({ message: 'Cross-company edit not allowed' });
      }
    }

    const { companyName, deviceId, deviceType } = req.body || {};
    const update = {};
    // superadmin can change companyName
    if (companyName !== undefined && actorRole === 'superadmin') update.companyName = companyName;
    if (deviceId !== undefined) update.deviceId = deviceId;
    if (deviceType !== undefined) update.deviceType = deviceType;

    const updated = await Device.findByIdAndUpdate(req.params.id, update, { new: true });
    return res.json({ success: true, message: 'Device updated successfully', device: updated });
  } catch (err) {
    console.error('Update device error:', err.message);
    return res.status(500).json({ message: 'Server error' });
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

// ✅ Update current user's profile (name, contactInfo only)
app.put('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const { name, contactInfo } = req.body;
    const update = {};
    
    if (name !== undefined) update.name = name;
    if (contactInfo !== undefined) update.contactInfo = contactInfo;

    // ✅ Only allow updating name and contactInfo for security
    const updated = await User.findByIdAndUpdate(req.user.id, update, { new: true });
    
    res.json({ 
      success: true, 
      message: 'Profile updated successfully', 
      user: updated 
    });
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Update user (superadmin: any; admin: only 'user' within own company)
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const actor = await User.findById(req.user.id);
    if (!actor) return res.status(401).json({ message: 'Unauthorized' });

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });

    if (actor.role !== 'superadmin') {
      if (actor.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      if (target.role !== 'user') return res.status(403).json({ message: 'Admins can edit only users' });
      if (actor.companyName !== target.companyName) return res.status(403).json({ message: 'Cross-company edit not allowed' });
    }

    const { email, password, role, name, companyName, contactInfo, isActive } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (contactInfo !== undefined) update.contactInfo = contactInfo;
    if (email !== undefined && actor.role === 'superadmin') update.email = email;
    if (companyName !== undefined && actor.role === 'superadmin') update.companyName = companyName;
    if (role !== undefined && actor.role === 'superadmin') update.role = role;
    if (password) update.password = password;
    if (isActive !== undefined) update.isActive = isActive;

    const updated = await User.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, message: 'User updated successfully', user: updated });
  } catch (err) {
    console.error('Update user error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Delete user with password confirmation (superadmin: any; admin: only 'user' within own company; block self-delete for non-superadmin)
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const actor = await User.findById(req.user.id);
    if (!actor) return res.status(401).json({ message: 'Unauthorized' });

    const { password } = req.body || {};
    if (!password || actor.password !== password) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    if (req.user.id === req.params.id && actor.role !== 'superadmin') {
      return res.status(403).json({ message: 'You cannot delete your own account' });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });

    if (actor.role !== 'superadmin') {
      if (actor.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      if (target.role !== 'user') return res.status(403).json({ message: 'Admins can delete only users' });
      if (actor.companyName !== target.companyName) return res.status(403).json({ message: 'Cross-company delete not allowed' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Delete device (superadmin: any; admin: only within own company)
app.delete('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const { role: actorRole, companyName: actorCompany } = req.user || {};
    if (!actorRole) return res.status(401).json({ message: 'Unauthorized' });

    const targetDevice = await Device.findById(req.params.id);
    if (!targetDevice) return res.status(404).json({ message: 'Device not found' });

    if (actorRole !== 'superadmin') {
      if (actorRole !== 'admin') return res.status(403).json({ message: 'Forbidden' });
      if (targetDevice.companyName !== actorCompany) {
        return res.status(403).json({ message: 'Cross-company delete not allowed' });
      }
    }

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
      // Request debugging info removed for production
    
    let transformedData = null;
    
    // ✅ Check if this is the new format (array of objects with dataType)
    if (Array.isArray(req.body) && req.body.length > 0 && req.body[0].dataType) {
      // Processing NEW format data
      
      // ✅ Transform new format to old format
      transformedData = transformNewFormatToOld(req.body);
      
              // Data transformed successfully
      
    } else {
      // Processing OLD format data
    
      // ✅ Use existing format directly
      const { craneCompany, DeviceID, Uid, Timestamp, Longitude, Latitude, DigitalInput1, DigitalInput2 } = req.body;
      
      transformedData = {
      craneCompany,
      DeviceID,
      Uid,
      Timestamp,
      Longitude,
      Latitude,
      DigitalInput1,
      DigitalInput2
      };
    }
    
      // Final extracted values debugging removed for production
    
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
    
          // Crane log saved successfully

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
    // Starting transformation of new format data
    
    // ✅ Initialize with default values
    let transformedData = {
      craneCompany: null,
      DeviceID: null,
      Uid: null,
      Timestamp: null,
      Longitude: "0.000000",
      Latitude: "0.000000",
      DigitalInput1: "0",
      DigitalInput2: "0"
    };
    
    // ✅ Process each object in the array
    dataArray.forEach((item, index) => {
      // Processing item
      
      // ✅ Extract common fields (should be same for all items)
      if (!transformedData.craneCompany) transformedData.craneCompany = item.craneCompany;
      if (!transformedData.DeviceID) transformedData.DeviceID = item.DeviceID;
      if (!transformedData.Timestamp) transformedData.Timestamp = item.Timestamp;
      if (!transformedData.Uid && (item.Uid || item.uid)) transformedData.Uid = item.Uid || item.uid;
      
      // ✅ Parse data based on dataType
      try {
        const parsedData = JSON.parse(item.data);
        
        switch (item.dataType) {
          case "Gps":
            if (Array.isArray(parsedData) && parsedData.length >= 2) {
              transformedData.Latitude = parsedData[0].toString();
              transformedData.Longitude = parsedData[1].toString();
              // GPS data parsed successfully
            }
            break;
            
          case "maintenance":
            if (Array.isArray(parsedData) && parsedData.length >= 1) {
              transformedData.DigitalInput2 = parsedData[0].toString();
              // Maintenance data parsed successfully
            }
            break;
            
          case "Ignition":
            if (Array.isArray(parsedData) && parsedData.length >= 1) {
              transformedData.DigitalInput1 = parsedData[0].toString();
              // Ignition data parsed successfully
            }
            break;
            
          default:
            // Unknown dataType encountered
        }
      } catch (parseError) {
        console.error(`❌ Error parsing data for ${item.dataType}:`, parseError);
      }
    });
    
    // Transformation completed successfully
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
    
    // User requesting crane data
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Build allowlist from Device collection
    const deviceQuery = role !== "superadmin" ? { companyName } : {};
    const allowedDevices = await Device.find(deviceQuery).lean();
    const allowedById = new Set(allowedDevices.map(d => d.deviceId));
    const deviceIdToUid = new Map(allowedDevices.map(d => [d.deviceId, d.uid]));

    // ✅ Get all crane devices for this company only, then filter by allowlist
    const craneDevicesRaw = await CraneLog.distinct("DeviceID", companyFilter);
    const craneDevices = craneDevicesRaw.filter(id => allowedById.has(id));
    
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
          today: { completed: 0, ongoing: 0, idle: 0, maintenance: 0 },
          thisWeek: { completed: 0, ongoing: 0, idle: 0, maintenance: 0 },
          thisMonth: { completed: 0, ongoing: 0, idle: 0, maintenance: 0 },
          thisYear: { completed: 0, ongoing: 0, idle: 0, maintenance: 0 }
        }
      });
    }

    // ✅ FIXED: Establish a consistent time basis for all calculations across environments
    const nowAligned = new Date();
    // Overview endpoint nowAligned calculated
          // Environment and production status checked

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
      let deviceLogs = await CraneLog.find(deviceFilter).lean();

      // ✅ If logs contain Uid, enforce UID match when provided in logs
      const requiredUid = deviceIdToUid.get(deviceId);
      if (requiredUid) {
        deviceLogs = deviceLogs.filter(l => !l.Uid || l.Uid === requiredUid);
      }
      
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
                      // Crane completed working session calculated
        } else {
                  // ✅ FIX: Ongoing working session - use current time calculation instead of broken period.startTime
        // The issue is that period.startTime was calculated with old parseTimestamp, so we need to recalculate
        const now = nowAligned;
        const startOfToday = getDateBoundary(nowAligned, true);
        
        let ongoingDuration;
        if (period.startTime < startOfToday) {
          // Cross-day ongoing session - count from midnight to current time
          ongoingDuration = (now - startOfToday) / (1000 * 60 * 60);
        } else {
          // Normal ongoing session within today
          ongoingDuration = (now - period.startTime) / (1000 * 60 * 60);
        }
        
        deviceOngoingHours += Math.max(0, ongoingDuration);
          hasOngoingSession = true;
                      // Crane ongoing working session calculated
        }
      });

      // ✅ Check for ongoing session (latest log) with proper cross-day handling
      const latestLog = deviceLogs[deviceLogs.length - 1];
      if (latestLog.DigitalInput1 === "1") {
            // Crane is currently operating
        
        try {
          const [latestDatePart, latestTimePart] = latestLog.Timestamp.split(' ');
          const [latestDay, latestMonth, latestYear] = latestDatePart.split('/').map(Number);
          const [latestHour, latestMinute, latestSecond] = latestTimePart.split(':').map(Number);
          // ✅ Create IST time - keep in IST for ongoing calculation
          const latestTimeIST = new Date(latestYear, latestMonth - 1, latestDay, latestHour, latestMinute, latestSecond);
          
          const now = nowAligned;
          
          // ✅ Check if this is a cross-day ongoing session
          const startOfToday = getDateBoundary(nowAligned, true);
          
          let ongoingHoursDiff;
          if (latestTimeIST < startOfToday) {
            // ✅ Crane was working before today - count from midnight to current time
            ongoingHoursDiff = (now - startOfToday) / (1000 * 60 * 60);
            console.log(`🔍 DEBUG: Cross-day ongoing session detected, counting from 00:00:00 to now`);
          } else {
            // ✅ Normal ongoing session within today
            ongoingHoursDiff = (now - latestTimeIST) / (1000 * 60 * 60);
          }
          
          // Latest time parsed and ongoing hours calculated
          
          // ✅ Handle ongoing sessions with environment-based timezone logic
          if (ongoingHoursDiff > 0 && ongoingHoursDiff < 72) { // Allow up to 3 days for ongoing sessions
            deviceOngoingHours = ongoingHoursDiff;
            hasOngoingSession = true;
            // Crane ongoing session calculated
          } else if (ongoingHoursDiff < 0 && ongoingHoursDiff > -72) {
            // ✅ Timezone issue - treat as ongoing session from latest timestamp
            deviceOngoingHours = Math.abs(ongoingHoursDiff);
            hasOngoingSession = true;
            // Crane ongoing session (timezone adjusted) calculated
          } else {
            // Ongoing hours rejected (outside valid range)
          }
        } catch (err) {
          console.error(`❌ Error calculating ongoing hours for crane ${deviceId}:`, err);
        }
      } else {
        // Crane is not currently operating
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

      // Crane summary calculated
    }

    // ✅ Calculate period-based metrics (working, maintenance, idle)
    const todayBoundary = getDateBoundary(nowAligned, true);
    const weekAgo = new Date(todayBoundary.getTime() - 7 * 24 * 60 * 60 * 1000);
    const currentMonthStart = getDateBoundary(new Date(nowAligned.getFullYear(), nowAligned.getMonth(), 1), true); // ✅ First day of current month at IST midnight
    const yearStart = getDateBoundary(new Date(nowAligned.getFullYear(), 0, 1), true); // ✅ Jan 1st at IST midnight
    
    // Time boundaries calculated for period calculations

    function overlapHours(period, startDate, endDate) {
      const periodEnd = period.startTime.getTime() + (period.duration * 60 * 60 * 1000);
      const periodStart = period.startTime.getTime();
      const queryStart = startDate.getTime();
      const queryEnd = endDate.getTime();
      
      if (periodStart < queryEnd && periodEnd > queryStart) {
        const overlapStart = Math.max(periodStart, queryStart);
        const overlapEnd = Math.min(periodEnd, queryEnd);
        return (overlapEnd - overlapStart) / (1000 * 60 * 60);
      }
      return 0;
    }

    async function calculateMetricsForPeriod(startDate, endDate) {
      let workingCompleted = 0, workingOngoing = 0;
      let maintenanceCompleted = 0, maintenanceOngoing = 0;
      let idleTotal = 0;
      const periodHours = (endDate - startDate) / (1000 * 60 * 60);

      for (const deviceId of craneDevices) {
        const deviceFilter = { ...companyFilter, DeviceID: deviceId };
        const allDeviceLogs = await CraneLog.find(deviceFilter).lean();
        allDeviceLogs.sort((a, b) => {
          const aTimestamp = parseTimestamp(a.Timestamp);
          const bTimestamp = parseTimestamp(b.Timestamp);
          if (!aTimestamp || !bTimestamp) return 0;
          return aTimestamp - bTimestamp;
        });

        // If no logs for this device → the entire period is idle for this device
        if (allDeviceLogs.length === 0) { 
          idleTotal += Math.max(0, periodHours); 
          continue; 
        }

        const workingPeriods = calculateConsecutivePeriods(allDeviceLogs, 'working');
        const maintenancePeriods = calculateConsecutivePeriods(allDeviceLogs, 'maintenance');

        // Per-device accumulators
        let dWorkingCompleted = 0, dWorkingOngoing = 0;
        let dMaintenanceCompleted = 0, dMaintenanceOngoing = 0;

        // Working periods (per device)
        workingPeriods.forEach(period => {
          if (!period.isOngoing) {
            const overlap = overlapHours(period, startDate, endDate);
            dWorkingCompleted += overlap;
          } else {
            // ✅ FIX: For ongoing working sessions, always use the correct boundary start time to avoid 5.5h offset
            // The issue is that period.startTime was calculated with old parseTimestamp, so we need to use startDate
            const effectiveStart = startDate;
            const duration = calculatePeriodDuration(effectiveStart, endDate, true);
            dWorkingOngoing += duration;
            
            // Ongoing working session details calculated
          }
        });

        // Maintenance periods (per device)
        maintenancePeriods.forEach(period => {
          if (!period.isOngoing) {
            const overlap = overlapHours(period, startDate, endDate);
            dMaintenanceCompleted += overlap;
          } else {
            // ✅ FIX: For ongoing maintenance sessions, use smart start time logic
            let effectiveStart;
            
            if (period.startTime >= startDate) {
              // ✅ Ongoing maintenance started TODAY - use actual maintenance start time
              effectiveStart = period.startTime;
              console.log(`🔍 [overview] Ongoing maintenance started today at ${period.startTimestamp}, using actual start time`);
            } else {
              // ✅ Ongoing maintenance started BEFORE today - use 00:00:00 of selected date
              effectiveStart = startDate;
              console.log(`🔍 [overview] Ongoing maintenance started before today (${period.startTimestamp}), using 00:00:00 as start`);
            }
            
            const duration = calculatePeriodDuration(effectiveStart, endDate, true);
            dMaintenanceOngoing += duration;
            
            // ✅ DEBUG: Log the ongoing maintenance calculation
            console.log(`🔍 [overview] Ongoing maintenance calculation:`, {
              deviceId,
              periodStart: period.startTimestamp,
              periodStartTime: period.startTime.toISOString(),
              startDate: startDate.toISOString(),
              effectiveStart: effectiveStart.toISOString(),
              endDate: endDate.toISOString(),
              durationHours: duration.toFixed(2),
              isStartedToday: period.startTime >= startDate
            });
            
            // Ongoing maintenance session details calculated
          }
        });

        // Compute per-device idle using per-device totals only
        const deviceWorking = dWorkingCompleted + dWorkingOngoing;
        const deviceMaintenance = dMaintenanceCompleted + dMaintenanceOngoing;
        const deviceIdle = Math.max(0, periodHours - deviceWorking - deviceMaintenance);
        idleTotal += deviceIdle;

        // Add per-device totals to global totals
        workingCompleted += dWorkingCompleted;
        workingOngoing += dWorkingOngoing;
        maintenanceCompleted += dMaintenanceCompleted;
        maintenanceOngoing += dMaintenanceOngoing;
      }

      const result = {
        working: {
          completed: Math.round(workingCompleted * 100) / 100,
          ongoing: Math.round(workingOngoing * 100) / 100,
          total: Math.round((workingCompleted + workingOngoing) * 100) / 100
        },
        maintenance: {
          completed: Math.round(maintenanceCompleted * 100) / 100,
          ongoing: Math.round(maintenanceOngoing * 100) / 100,
          total: Math.round((maintenanceCompleted + maintenanceOngoing) * 100) / 100
        },
        idle: Math.round(idleTotal * 100) / 100
      };
      
      // 🔍 DEBUG: Log final results for this period
      // Period results calculated
      
      return result;
    }

    // ✅ Calculate metrics for all periods in parallel
    const [todayMetrics, weekMetrics, monthMetrics, yearMetrics] = await Promise.all([
      calculateMetricsForPeriod(todayBoundary, nowAligned),
      calculateMetricsForPeriod(weekAgo, nowAligned),
      calculateMetricsForPeriod(currentMonthStart, nowAligned),
      calculateMetricsForPeriod(yearStart, nowAligned)
    ]);

    // Final totals calculated

    const finalResponse = {
      totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
      completedHours: Math.round(completedHours * 100) / 100,
      ongoingHours: Math.round(ongoingHours * 100) / 100,
      activeCranes,
      inactiveCranes,
      underMaintenance,
      craneDevices, // ✅ Add crane devices to response
      quickStats: {
        today: { completed: todayMetrics.working.completed, ongoing: todayMetrics.working.ongoing, maintenance: todayMetrics.maintenance.total, idle: todayMetrics.idle },
        thisWeek: { completed: weekMetrics.working.completed, ongoing: weekMetrics.working.ongoing, maintenance: weekMetrics.maintenance.total, idle: weekMetrics.idle },
        thisMonth: { completed: monthMetrics.working.completed, ongoing: monthMetrics.working.ongoing, maintenance: monthMetrics.maintenance.total, idle: monthMetrics.idle },
        thisYear: { completed: yearMetrics.working.completed, ongoing: yearMetrics.working.ongoing, maintenance: yearMetrics.maintenance.total, idle: yearMetrics.idle }
      }
    };
    
    // 🔍 DEBUG: Log the final Quick Stats being sent to frontend
    // Final response quick stats calculated
    
    res.json(finalResponse);

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
    
    // User requesting crane movement data
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Build allowlist from Device collection (admin = own company, superadmin = all)
    const deviceQuery = role !== "superadmin" ? { companyName } : {};
    const allowedDevices = await Device.find(deviceQuery).lean();
    const allowedById = new Set(allowedDevices.map(d => d.deviceId));
    
    // ✅ Use provided date or current date
    const targetDate = date || getCurrentDateString();
    
    // ✅ Get all crane devices for this company, then filter by allowlist
    const craneDevicesRaw = await CraneLog.distinct("DeviceID", companyFilter);
    const craneDevices = craneDevicesRaw.filter(id => allowedById.has(id));
    
    if (craneDevices.length === 0) {
      return res.json({
        date: targetDate,
        craneDistances: {},
        totalDistance: 0,
        averageDistance: 0
      });
    }
    
    // ✅ Get all crane logs for the target date
    const allCraneLogs = await CraneLog.find(companyFilter).lean();
    
    // ✅ Filter logs for the target date
    const dateFilteredLogs = allCraneLogs.filter(log => {
      const logDate = log.Timestamp.split(' ')[0]; // Extract date part
      return logDate === targetDate;
    });
    
    // ✅ Calculate distances using location utils
    const { craneDistances, totalDistance, averageDistance } = calculateAllCraneDistances(dateFilteredLogs, targetDate);
    
    // ✅ NEW: Ensure ALL cranes are included (even with 0m distance)
    const completeCraneDistances = {};
    
    // ✅ Add cranes with movement data
    Object.keys(craneDistances).forEach(deviceId => {
      completeCraneDistances[deviceId] = craneDistances[deviceId];
    });
    
    // ✅ Add cranes with 0m distance (no movement data)
    for (const deviceId of craneDevices) {
      if (!completeCraneDistances[deviceId]) {
        // ✅ Find any log for this crane to get location data (not just for target date)
        const craneLogs = allCraneLogs.filter(log => log.DeviceID === deviceId);
        
        if (craneLogs.length > 0) {
          // ✅ Use the most recent log for location data
          craneLogs.sort((a, b) => {
            const aTimestamp = parseTimestamp(a.Timestamp);
            const bTimestamp = parseTimestamp(b.Timestamp);
            if (!aTimestamp || !bTimestamp) return 0;
            return bTimestamp - aTimestamp; // Sort by most recent first
          });
          
          const mostRecentLog = craneLogs[0];
          completeCraneDistances[deviceId] = {
            deviceId,
            distance: 0,
            startLocation: {
              lat: mostRecentLog.Latitude,
              lon: mostRecentLog.Longitude,
              timestamp: mostRecentLog.Timestamp
            },
            endLocation: {
              lat: mostRecentLog.Latitude,
              lon: mostRecentLog.Longitude,
              timestamp: mostRecentLog.Timestamp
            }
          };
        } else {
          // ✅ No logs at all for this crane - skip it for now
          console.log(`⚠️ No logs found for crane ${deviceId}`);
          continue;
        }
      }
    }
    
    // Crane movement data calculated successfully
    
    res.json({
      date: targetDate,
      craneDistances: completeCraneDistances,
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
    
    // User requesting comprehensive export data
    
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
    
    // Comprehensive export data prepared successfully
    
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
    
    // ✅ Add working sessions (both completed and ongoing)
    workingPeriods.forEach(period => {
      const sessionData = {
        craneId,
        sessionType: 'Working',
        // Keep original formatted strings from logs to avoid Invalid Date
        startTime: period.startTimestamp,
        endTime: period.isOngoing ? 'Running' : period.endTimestamp,
        duration: period.duration,
        isOngoing: period.isOngoing,
        startLocation: {
          lat: period.logs[0]?.Latitude || 'N/A',
          lon: period.logs[0]?.Longitude || 'N/A'
        },
        endLocation: {
          lat: period.isOngoing ? 'N/A' : (period.logs[period.logs.length - 1]?.Latitude || 'N/A'),
          lon: period.isOngoing ? 'N/A' : (period.logs[period.logs.length - 1]?.Longitude || 'N/A')
        }
      };
      sessionsData.push(sessionData);
    });
    
    // ✅ Add maintenance sessions (both completed and ongoing)
    maintenancePeriods.forEach(period => {
      const sessionData = {
        craneId,
        sessionType: 'Maintenance',
        // Keep original formatted strings from logs to avoid Invalid Date
        startTime: period.startTimestamp,
        endTime: period.isOngoing ? 'Running' : period.endTimestamp,
        duration: period.duration,
        isOngoing: period.isOngoing,
        startLocation: {
          lat: period.logs[0]?.Latitude || 'N/A',
          lon: period.logs[0]?.Longitude || 'N/A'
        },
        endLocation: {
          lat: period.isOngoing ? 'N/A' : (period.logs[period.logs.length - 1]?.Latitude || 'N/A'),
          lon: period.isOngoing ? 'N/A' : (period.logs[period.logs.length - 1]?.Longitude || 'N/A')
        }
      };
      sessionsData.push(sessionData);
    });
  }
  
      // Sessions generated successfully
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
    // Processing working periods for crane
    workingPeriods.forEach(period => {
      if (period.isOngoing) {
        craneWorkingOngoing += period.duration;
                  // Ongoing period calculated
      } else {
        craneWorkingCompleted += period.duration;
                  // Completed period calculated
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
    
    // ✅ Build allowlist from Device collection (admin = own company, superadmin = all)
    const deviceQuery = role !== "superadmin" ? { companyName } : {};
    const allowedDevices = await Device.find(deviceQuery).lean();
    const allowedById = new Set(allowedDevices.map(d => d.deviceId));
    
    // ✅ Get all crane devices for this company, then filter by allowlist
    const craneDevicesRaw = await CraneLog.distinct("DeviceID", companyFilter);
    const craneDevices = craneDevicesRaw.filter(id => allowedById.has(id));
    
    // ✅ Get crane logs only for allowed devices
    const craneLogs = await CraneLog.find({
      ...companyFilter,
      DeviceID: { $in: craneDevices }
    }).lean();
    
    // Crane logs fetched successfully
    
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
    
    // ✅ Build allowlist from Device collection (admin = own company, superadmin = all)
    const deviceQuery = role !== "superadmin" ? { companyName } : {};
    const allowedDevices = await Device.find(deviceQuery).lean();
    const allowedById = new Set(allowedDevices.map(d => d.deviceId));
    
    // ✅ Filter by selected cranes if specified (only from allowed devices)
    let selectedCranes = [];
    if (cranes && cranes.length > 0) {
      const requestedCranes = cranes.split(',').map(s => s.trim()).filter(Boolean);
      selectedCranes = requestedCranes.filter(id => allowedById.has(id));
    }
    
    // ✅ Get crane logs with filters (only for allowed devices)
    const craneFilter = selectedCranes.length > 0 
      ? { DeviceID: { $in: selectedCranes } } 
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
    
    // Available months found successfully
    
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
    const { cranes, start, end } = req.query;
    
    console.log('🔍 User requesting monthly crane stats:', { role, companyName, cranes, start, end });
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Build allowlist from Device collection (admin = own company, superadmin = all)
    const deviceQuery = role !== "superadmin" ? { companyName } : {};
    const allowedDevices = await Device.find(deviceQuery).lean();
    const allowedById = new Set(allowedDevices.map(d => d.deviceId));
    
    // ✅ Get all crane devices for this company, then filter by allowlist
    const craneDevicesRaw = await CraneLog.distinct("DeviceID", companyFilter);
    const craneDevices = craneDevicesRaw.filter(id => allowedById.has(id));
    
    // ✅ Narrow down to requested cranes if provided (only from allowed devices)
    const requested = (cranes || "").split(',').map(s => s.trim()).filter(Boolean);
    const selectedDevices = requested.length > 0 ? craneDevices.filter(id => requested.includes(id)) : craneDevices;
    
    if (selectedDevices.length === 0) {
      return res.json({ monthlyData: [] });
    }

    const toISTDate = (yyyy_mm_dd, endOfDay = false) => {
      const [y, m, d] = (yyyy_mm_dd || '').split('-').map(Number);
      if (!y || !m || !d) return null;
      return endOfDay ? new Date(y, m - 1, d, 23, 59, 59) : new Date(y, m - 1, d, 0, 0, 0);
    };

    const now = getCurrentTimeInIST();

    // ✅ Build month buckets (default last 6 months, or based on provided range)
    const monthBuckets = [];
    if (start && end) {
      const rangeStart = toISTDate(start, false);
      const rangeEnd = toISTDate(end, true);
      if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
        return res.json({ monthlyData: [] });
      }
      let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      const lastMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
      while (cursor <= lastMonth) {
        const ms = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const me = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
        const label = `${ms.toLocaleString('default', { month: 'short' })} ${ms.getFullYear()}`;
        monthBuckets.push({ start: ms, end: me, label });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    } else {
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const ms = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const me = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);
        const label = `${monthDate.toLocaleString('default', { month: 'short' })} ${monthDate.getFullYear()}`;
        monthBuckets.push({ start: ms, end: me, label });
      }
    }

    const monthlyData = [];

    for (const bucket of monthBuckets) {
      const monthStart = bucket.start;
      let monthEnd = bucket.end;
      const nowClamp = getCurrentTimeInIST();
      if (monthEnd > nowClamp) monthEnd = nowClamp;
      let monthUsageHours = 0;
      let monthMaintenanceHours = 0;

      // ✅ Calculate for each selected device
      for (const deviceId of selectedDevices) {
        const deviceFilter = { ...companyFilter, DeviceID: deviceId };
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

        // Working periods
        const workingPeriods = calculateConsecutivePeriods(monthLogs, 'working');
        for (const period of workingPeriods) {
                            if (period.isOngoing) {
                    // ✅ FIX: For ongoing periods, always use monthStart to avoid 5.5h offset
                    // The issue is that period.startTime was calculated with old parseTimestamp
                    const duration = calculatePeriodDuration(monthStart, getCurrentTimeInIST(), true);
                    monthUsageHours += duration;
                  } else {
            const effectiveStart = period.startTime < monthStart ? monthStart : period.startTime;
            const effectiveEnd = period.endTime > monthEnd ? monthEnd : period.endTime;
            const duration = calculatePeriodDuration(effectiveStart, effectiveEnd, false);
            monthUsageHours += duration;
          }
        }

        // Maintenance periods
        const maintenancePeriods = calculateConsecutivePeriods(monthLogs, 'maintenance');
        for (const period of maintenancePeriods) {
                            if (period.isOngoing) {
                    // ✅ FIX: For ongoing periods, always use monthStart to avoid 5.5h offset
                    // The issue is that period.startTime was calculated with old parseTimestamp
                    const duration = calculatePeriodDuration(monthStart, getCurrentTimeInIST(), true);
                    monthMaintenanceHours += duration;
                  } else {
            const effectiveStart = period.startTime < monthStart ? monthStart : period.startTime;
            const effectiveEnd = period.endTime > monthEnd ? monthEnd : period.endTime;
            const duration = calculatePeriodDuration(effectiveStart, effectiveEnd, false);
            monthMaintenanceHours += duration;
          }
        }
      }

      monthlyData.push({
        month: bucket.label,
        usageHours: Math.round(monthUsageHours * 100) / 100,
        maintenanceHours: Math.round(monthMaintenanceHours * 100) / 100
      });
    }

    // Monthly crane stats calculated successfully
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
    const { cranes, start, end } = req.query;
    
    console.log('🔍 User requesting individual crane stats:', { role, companyName, cranes, start, end });
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Build allowlist from Device collection (admin = own company, superadmin = all)
    const deviceQuery = role !== "superadmin" ? { companyName } : {};
    const allowedDevices = await Device.find(deviceQuery).lean();
    const allowedById = new Set(allowedDevices.map(d => d.deviceId));
    
    // ✅ Get unique crane devices for this company, then filter by allowlist
    const craneDevicesRaw = await CraneLog.distinct("DeviceID", companyFilter);
    const craneDevices = craneDevicesRaw.filter(id => allowedById.has(id));
    
    // ✅ Narrow down devices by query if provided
    const requested = (cranes || "").split(',').map(s => s.trim()).filter(Boolean);
    const selectedDevices = requested.length > 0 ? craneDevices.filter(id => requested.includes(id)) : craneDevices;
    
    if (selectedDevices.length === 0) {
      return res.json({ craneData: [] });
    }

    const toISTDate = (yyyy_mm_dd, endOfDay = false) => {
      const [y, m, d] = (yyyy_mm_dd || '').split('-').map(Number);
      if (!y || !m || !d) return null;
      return endOfDay ? new Date(y, m - 1, d, 23, 59, 59) : new Date(y, m - 1, d, 0, 0, 0);
    };

    // ✅ Determine period
    let periodStart, periodEnd;
    if (start && end) {
      periodStart = toISTDate(start, false);
      periodEnd = toISTDate(end, true);
      if (!periodStart || !periodEnd || periodStart > periodEnd) {
        return res.json({ craneData: [] });
      }
    } else {
    const now = getCurrentTimeInIST();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      periodStart = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }
    
    // ✅ Calculate total hours in the selected period
    // Clamp end to now if it's in the future
const nowForClamp = getCurrentTimeInIST();
const effectivePeriodEnd = periodEnd > nowForClamp ? nowForClamp : periodEnd;
const totalPeriodHours = (effectivePeriodEnd - periodStart) / (1000 * 60 * 60);
    
    const craneData = [];

    // ✅ Calculate stats for each selected device
    for (const deviceId of selectedDevices) {
      const deviceFilter = { ...companyFilter, DeviceID: deviceId };
      const deviceLogs = await CraneLog.find(deviceFilter).lean();
      
      // Filter logs within the period
      let periodLogs = deviceLogs.filter(log => {
        try {
          const [datePart, timePart] = log.Timestamp.split(' ');
          const [day, month, year] = datePart.split('/').map(Number);
          const [hour, minute, second] = timePart.split(':').map(Number);
          const logTime = new Date(year, month - 1, day, hour, minute, second);
          return logTime >= periodStart && logTime <= effectivePeriodEnd;
        } catch (err) {
          console.error(`❌ Error parsing timestamp for crane stats filtering:`, err);
          return false;
        }
      });

      // ✅ Carry-over handling: if the last log BEFORE periodStart indicates the crane was
      // working or under maintenance, seed a synthetic log at 00:00 so periods start at midnight
      try {
        const formatAsDdMmYyyyHhMmSs = (d) => {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = d.getFullYear();
          const hh = String(d.getHours()).padStart(2, '0');
          const mi = String(d.getMinutes()).padStart(2, '0');
          const ss = String(d.getSeconds()).padStart(2, '0');
          return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
        };

        // Find the last log before the selected start
        const lastBefore = [...deviceLogs].reverse().find(x => {
          const ts = parseTimestamp(x.Timestamp);
          return ts && ts < periodStart;
        });

        if (lastBefore) {
          const wasMaint = lastBefore.DigitalInput2 === "1";
          const wasWorking = lastBefore.DigitalInput1 === "1" && lastBefore.DigitalInput2 === "0";
          if (wasMaint || wasWorking) {
            const synthetic = {
              Timestamp: formatAsDdMmYyyyHhMmSs(periodStart),
              DigitalInput1: wasWorking ? "1" : lastBefore.DigitalInput1,
              DigitalInput2: wasMaint ? "1" : (wasWorking ? "0" : lastBefore.DigitalInput2)
            };
            periodLogs = [synthetic, ...periodLogs];
            console.log(`🔧 [crane-stats] ${deviceId} carry-over at start: seeded synthetic log ${synthetic.Timestamp} DI1=${synthetic.DigitalInput1} DI2=${synthetic.DigitalInput2}`);
          }
        }
      } catch (e) {
        console.log(`⚠️ [crane-stats] ${deviceId} carry-over seed failed:`, e?.message || e);
      }

      if (periodLogs.length === 0) {
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

      // Working periods
      const workingPeriods = calculateConsecutivePeriods(periodLogs, 'working');
      for (const period of workingPeriods) {
        if (period.isOngoing) {
          // ✅ FIX: For ongoing sessions, cap at the end of selected period (not current time)
          const effectiveStart = period.startTime < periodStart ? periodStart : period.startTime;
          const duration = calculatePeriodDuration(effectiveStart, effectivePeriodEnd, false);
          workingHours += duration;
        } else {
          const effectiveStart = period.startTime < periodStart ? periodStart : period.startTime;
          const effectiveEnd = period.endTime > effectivePeriodEnd ? effectivePeriodEnd : period.endTime;
          const duration = calculatePeriodDuration(effectiveStart, effectiveEnd, false);
          workingHours += duration;
        }
      }

      // Maintenance periods
      const maintenancePeriods = calculateConsecutivePeriods(periodLogs, 'maintenance');
      for (const period of maintenancePeriods) {
        if (period.isOngoing) {
          // ✅ FIX: For ongoing sessions, cap at the end of selected period (not current time)
          const effectiveStart = period.startTime < periodStart ? periodStart : period.startTime;
          const duration = calculatePeriodDuration(effectiveStart, effectivePeriodEnd, false);
          maintenanceHours += duration;
        } else {
          const effectiveStart = period.startTime < periodStart ? periodStart : period.startTime;
          const effectiveEnd = period.endTime > effectivePeriodEnd ? effectivePeriodEnd : period.endTime;
          const duration = calculatePeriodDuration(effectiveStart, effectiveEnd, false);
          maintenanceHours += duration;
        }
      }

      const inactiveHours = Math.max(0, totalPeriodHours - workingHours - maintenanceHours);

      craneData.push({
        craneId: deviceId,
        workingHours: Math.round(workingHours * 100) / 100,
        inactiveHours: Math.round(inactiveHours * 100) / 100,
        maintenanceHours: Math.round(maintenanceHours * 100) / 100
      });
    }

    
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
    
    // ✅ Build allowlist from Device collection (admin = own company, superadmin = all)
    const deviceQuery = role !== "superadmin" ? { companyName } : {};
    const allowedDevices = await Device.find(deviceQuery).lean();
    const allowedById = new Set(allowedDevices.map(d => d.deviceId));
    
    // ✅ Get all crane devices for this company, then filter by allowlist
    const craneDevicesRaw = await CraneLog.distinct("DeviceID", companyFilter);
    const craneDevices = craneDevicesRaw.filter(id => allowedById.has(id));
    
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
    
    // ✅ Clamp end to now if target month is the current month
    const nowForClampPM = getCurrentTimeInIST();
    const effectiveMonthEnd = (targetYear === nowForClampPM.getFullYear() && targetMonth === nowForClampPM.getMonth())
      ? (monthEnd > nowForClampPM ? nowForClampPM : monthEnd)
      : monthEnd;
    
    // ✅ Calculate total hours in the (effective) month period
    const totalHours = (effectiveMonthEnd - monthStart) / (1000 * 60 * 60);
    
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
          return logTime >= monthStart && logTime <= effectiveMonthEnd;
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
                  // ✅ FIX: For ongoing sessions, always use monthStart to avoid 5.5h offset
                  // The issue is that period.startTime was calculated with old parseTimestamp
                  const currentTime = getCurrentTimeInIST();
                  const duration = calculatePeriodDuration(monthStart, currentTime, true);
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
                  // ✅ FIX: For ongoing sessions, always use monthStart to avoid 5.5h offset
                  // The issue is that period.startTime was calculated with old parseTimestamp
                  const currentTime = getCurrentTimeInIST();
                  const duration = calculatePeriodDuration(monthStart, currentTime, true);
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
    
    // ✅ Build allowlist from Device collection (admin = own company, superadmin = all)
    const deviceQuery = role !== "superadmin" ? { companyName } : {};
    const allowedDevices = await Device.find(deviceQuery).lean();
    const allowedById = new Set(allowedDevices.map(d => d.deviceId));
    
    // ✅ Get all crane devices for this company, then filter by allowlist
    const craneDevicesRaw = await CraneLog.distinct("DeviceID", companyFilter);
    const craneDevices = craneDevicesRaw.filter(id => allowedById.has(id));
    
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
    
    // ✅ Clamp end to now if target is the current month
    const nowForClampMaint = getCurrentTimeInIST();
    const effectiveMonthEnd = (targetYear === nowForClampMaint.getFullYear() && targetMonth === nowForClampMaint.getMonth())
      ? (monthEnd > nowForClampMaint ? nowForClampMaint : monthEnd)
      : monthEnd;
    
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
          return logTime >= monthStart && logTime <= effectiveMonthEnd;
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
              const endClamp = currentTime > effectiveMonthEnd ? effectiveMonthEnd : currentTime;
              sessionDuration = (endClamp - startTimeIST) / (1000 * 60 * 60);
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
    
    // ✅ Build allowlist from Device collection
    const deviceQuery = role !== "superadmin" ? { companyName } : {};
    const allowedDevices = await Device.find(deviceQuery).lean();
    const allowedById = new Set(allowedDevices.map(d => d.deviceId));
    const deviceIdToUid = new Map(allowedDevices.map(d => [d.deviceId, d.uid]));

    // ✅ Get unique crane devices for this company, then filter by allowlist
    const craneDevicesRaw = await CraneLog.distinct("DeviceID", companyFilter);
    const craneDevices = craneDevicesRaw.filter(id => allowedById.has(id));
    
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

// ✅ GET: Fetch live crane locations for map display
app.get("/api/crane/live-locations", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    
    console.log('🔍 User requesting live crane locations:', { role, companyName });
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Build allowlist from Device collection (admin = own company, superadmin = all)
    const deviceQuery = role !== "superadmin" ? { companyName } : {};
    const allowedDevices = await Device.find(deviceQuery).lean();
    const allowedById = new Set(allowedDevices.map(d => d.deviceId));
    const deviceIdToUid = new Map(allowedDevices.map(d => [d.deviceId, d.uid]));

    // ✅ Get unique crane devices for this company, then filter by allowlist
    const craneDevicesRaw = await CraneLog.distinct("DeviceID", companyFilter);
    const craneDevices = craneDevicesRaw.filter(id => allowedById.has(id));
    
    // ✅ Get latest log for each device with full details
    const liveCranes = await Promise.all(
      craneDevices.map(async (deviceId) => {
        let latestLog = await CraneLog.findOne(
          { ...companyFilter, DeviceID: deviceId },
          { 
            Longitude: 1, 
            Latitude: 1, 
            Timestamp: 1, 
            DigitalInput1: 1, 
            DigitalInput2: 1,
            Uid: 1,
            craneCompany: 1
          },
          { sort: { createdAt: -1 } }
        ).lean();
        
        if (!latestLog) return null;

        // ✅ Enforce UID match if present in log
        const requiredUid = deviceIdToUid.get(deviceId);
        if (requiredUid && latestLog.Uid && latestLog.Uid !== requiredUid) {
          return null;
        }
        
        // ✅ Determine status based on DigitalInput values
        let status = "idle";
        if (latestLog.DigitalInput2 === "1") {
          status = "maintenance";
        } else if (latestLog.DigitalInput1 === "1") {
          status = "working";
        }
        
        return {
          id: deviceId,
          craneId: deviceId,
          status: status,
          latitude: parseFloat(latestLog.Latitude) || 0,
          longitude: parseFloat(latestLog.Longitude) || 0,
          location: `${latestLog.Latitude}, ${latestLog.Longitude}`,
          lastUpdated: latestLog.Timestamp,
          company: latestLog.craneCompany,
          digitalInput1: latestLog.DigitalInput1,
          digitalInput2: latestLog.DigitalInput2,
          uid: latestLog.Uid || null
        };
      })
    );
    
    // ✅ Filter out null values and return valid cranes
    const validCranes = liveCranes.filter(crane => crane !== null);
    
    console.log(`✅ Found ${validCranes.length} live cranes for ${companyName}`);
    
    res.json(validCranes);
    
  } catch (err) {
    console.error("❌ Live crane locations fetch error:", err);
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

// ✅ GET: Fetch daily crane statistics for tooltips
app.get("/api/crane/daily-stats/:deviceId", authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { role, companyName } = req.user;
    
    console.log('🔍 User requesting daily stats for crane:', deviceId, { role, companyName });
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Build allowlist from Device collection (admin = own company, superadmin = all)
    const deviceQuery = role !== "superadmin" ? { companyName } : {};
    const allowedDevices = await Device.find(deviceQuery).lean();
    const allowedById = new Set(allowedDevices.map(d => d.deviceId));
    
    // ✅ Verify the requested device is allowed
    if (!allowedById.has(deviceId)) {
      console.log(`❌ Device ${deviceId} not found in allowed devices for ${companyName}`);
      return res.status(403).json({ error: "Device not authorized" });
    }
    
    // ✅ Get today's date range in IST consistently (use same basis as parseTimestamp/getDateBoundary)
    const now = new Date();
    const startOfDay = getDateBoundary(now, true); // 00:00:00 IST
    
    console.log('🔍 Date range:', { startOfDay, today: now });
    
    // ✅ Parse timestamp correctly (DD/MM/YYYY HH:MM:SS) as IST consistently in all environments
    const parseTimestamp = (timestampStr) => {
      try {
        const [datePart, timePart] = timestampStr.split(' ');
        const [day, month, year] = datePart.split('/').map(Number);
        const [hour, minute, second] = (timePart || '00:00:00').split(':').map(Number);
        if (isProd) {
          // Server runs in UTC → build an IST-equivalent instant by subtracting 5.5h from UTC wall-clock
          const utcMillis = Date.UTC(year, month - 1, day, hour, minute, second) - (5.5 * 60 * 60 * 1000);
          return new Date(utcMillis);
        } else {
          // Local dev assumed IST → construct directly without adding any offset
          return new Date(year, month - 1, day, hour, minute, second);
        }
      } catch (err) {
        console.error(`❌ Error parsing timestamp: ${timestampStr}`, err);
        return null;
      }
    };
    
    // ✅ Fetch all logs for this device today (use string comparison for DD/MM/YYYY format)
    const allLogs = await CraneLog.find({
      ...companyFilter,
      DeviceID: deviceId
    }, {
      Timestamp: 1,
      DigitalInput1: 1,
      DigitalInput2: 1
    }).sort({ Timestamp: 1 }).lean();
    
    console.log('🔍 Found total logs:', allLogs.length);
    
    // ✅ Filter logs for today only (DD/MM/YYYY format) - use IST date
    const todayLogs = allLogs.filter(log => {
      const logDate = log.Timestamp.split(' ')[0]; // Get date part only
      const todayDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
      return logDate === todayDate;
    });
    
    console.log('🔍 Found today logs:', todayLogs.length);
    if (todayLogs.length > 0) {
      console.log('🔍 Sample today log:', todayLogs[0]);
    }
    
    // ✅ Check if crane is working from previous day (ongoing session)
    if (todayLogs.length === 0) {
      // ✅ Check last log before startOfDay for carry-over
      const lastBeforeStart = [...allLogs].reverse().find((entry) => {
        const ts = parseTimestamp(entry.Timestamp);
        return ts && ts < startOfDay;
      });
      if (lastBeforeStart && lastBeforeStart.DigitalInput1 === "1" && lastBeforeStart.DigitalInput2 === "0") {
        const workingHours = (now - startOfDay) / (1000 * 60 * 60);
        console.log(`🔍 ${deviceId} has ongoing working session from yesterday, calculating from 00:00:00 to now`);
        console.log(`🔍 [DEBUG] Carry-over calculation: now=${now.toISOString()}, startOfDay=${startOfDay.toISOString()}, workingHours=${workingHours}`);
        return res.json({
          deviceId,
          workingHours: Math.round(workingHours * 100) / 100,
          idleHours: 0,
          maintenanceHours: 0,
          totalHours: Math.round(workingHours * 100) / 100,
          lastSeen: lastBeforeStart.Timestamp
        });
      }
      
      // ✅ No ongoing session - return zero hours
      return res.json({
        deviceId,
        workingHours: 0,
        idleHours: 0,
        maintenanceHours: 0,
        totalHours: 0,
        lastSeen: null
      });
    }
    
    // ✅ Calculate working hours based on DigitalInput changes
    let workingTime = 0;
    let idleTime = 0;
    let maintenanceTime = 0;
    let lastStatus = null;
    let statusStartTime = null;
    
    // ✅ Seed synthetic first log at 00:00 if last pre-start status was working/maintenance
    (function seedCarryOverIfNeeded() {
      const lastBeforeStart = [...allLogs].reverse().find((entry) => {
        const ts = parseTimestamp(entry.Timestamp);
        return ts && ts < startOfDay;
      });
      if (!lastBeforeStart) return;
      const wasWorking = lastBeforeStart.DigitalInput1 === "1" && lastBeforeStart.DigitalInput2 === "0";
      const wasMaint = lastBeforeStart.DigitalInput2 === "1";
      if (wasWorking || wasMaint) {
        const dd = String(startOfDay.getDate()).padStart(2, '0');
        const mm = String(startOfDay.getMonth() + 1).padStart(2, '0');
        const yyyy = startOfDay.getFullYear();
        const ts = `${dd}/${mm}/${yyyy} 00:00:00`;
        todayLogs.unshift({
          Timestamp: ts,
          DigitalInput1: wasWorking ? "1" : lastBeforeStart.DigitalInput1,
          DigitalInput2: wasMaint ? "1" : (wasWorking ? "0" : lastBeforeStart.DigitalInput2)
        });
        console.log(`🔧 [daily-stats] ${deviceId} seeded synthetic start log at 00:00 due to carry-over`);
      }
    })();

    for (let i = 0; i < todayLogs.length; i++) {
      const log = todayLogs[i];
      const currentStatus = log.DigitalInput2 === "1" ? "maintenance" : 
                           log.DigitalInput1 === "1" ? "working" : "idle";
      
      if (i === 0) {
        // ✅ First log - check if this is an ongoing session from previous day
        const firstLogTime = parseTimestamp(log.Timestamp);
        if (currentStatus === "working" && firstLogTime <= startOfDay) {
          // ✅ Crane was working before or at midnight today - start counting from midnight IST
          lastStatus = currentStatus;
          statusStartTime = startOfDay;
          console.log(`🔍 ${deviceId} ongoing working session detected, starting from 00:00:00`);
        } else {
          // ✅ Normal session starting today
          lastStatus = currentStatus;
          statusStartTime = parseTimestamp(log.Timestamp);
        }
      } else if (currentStatus !== lastStatus) {
        // Status changed - calculate time for previous status
        const statusEndTime = parseTimestamp(log.Timestamp);
        if (statusStartTime && statusEndTime) {
          const duration = (statusEndTime - statusStartTime) / (1000 * 60 * 60); // Convert to hours
          
          if (lastStatus === "working") {
            workingTime += duration;
          } else if (lastStatus === "idle") {
            idleTime += duration;
          } else if (lastStatus === "maintenance") {
            maintenanceTime += duration;
          }
          
          // Update for new status
          lastStatus = currentStatus;
          statusStartTime = parseTimestamp(log.Timestamp);
        }
      }
    }
    
    // ✅ Calculate time for the last status (from last change to current time)
    if (statusStartTime) {
      let finalDuration;
      
      // ✅ Check if this is an ongoing session from previous day
      if (lastStatus === "working") {
        // ✅ If crane was working before today, count from 12 AM to current time
        const firstLogTime = parseTimestamp(todayLogs[0].Timestamp);
        if (firstLogTime <= startOfDay) {
                  // ✅ Cross-day ongoing session - count from midnight to current time
        finalDuration = (now - startOfDay) / (1000 * 60 * 60);
        console.log(`🔍 ${deviceId} has ongoing working session from yesterday, counting from 00:00:00 to now`);
        console.log(`🔍 [DEBUG] Duration calculation: now=${now.toISOString()}, startOfDay=${startOfDay.toISOString()}, finalDuration=${finalDuration}`);
        } else {
          // ✅ Normal ongoing session within today
          finalDuration = (now - statusStartTime) / (1000 * 60 * 60);
          console.log(`🔍 [DEBUG] Normal ongoing session: now=${now.toISOString()}, statusStartTime=${statusStartTime.toISOString()}, finalDuration=${finalDuration}`);
        }
        workingTime += finalDuration;
      } else if (lastStatus === "idle") {
        finalDuration = (now - statusStartTime) / (1000 * 60 * 60);
        idleTime += finalDuration;
      } else if (lastStatus === "maintenance") {
        finalDuration = (now - statusStartTime) / (1000 * 60 * 60);
        maintenanceTime += finalDuration;
      }
    }
    
    // ✅ Get last seen timestamp
    const lastSeen = todayLogs[todayLogs.length - 1]?.Timestamp;
    
    // ✅ Calculate total hours
    const totalHours = workingTime + idleTime + maintenanceTime;
    
    const stats = {
      deviceId,
      workingHours: Math.round(workingTime * 100) / 100, // Round to 2 decimal places
      idleHours: Math.round(idleTime * 100) / 100,
      maintenanceHours: Math.round(maintenanceTime * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
      lastSeen: lastSeen
    };
    
    console.log(`✅ Daily stats for crane ${deviceId}:`, stats);
    res.json(stats);
    
  } catch (err) {
    console.error("❌ Daily crane stats fetch error:", err);
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
        isActive: true, // New Google users are active by default
      });

      await user.save();
      console.log("✅ New Google user created:", user.email);
    }

    // ✅ Check if existing user is active
    if (user.isActive === false) {
      return res.status(403).json({ message: "Account is deactivated. Please contact your administrator." });
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

    // ✅ Check if user is active
    if (user.isActive === false) {
      return res.status(403).json({ message: "Account is deactivated. Please contact your administrator." });
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










// ✅ Company Dashboard Access Control APIs

// Get all companies with dashboard access
app.get("/api/company-dashboard-access", authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    
    if (role !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all companies from User model (filter out empty/null values)
    const companies = await User.distinct('companyName');
    const validCompanies = companies.filter(companyName => 
      companyName && companyName.trim() !== '' && companyName !== null && companyName !== undefined
    );
    
    console.log('🔍 Found companies:', validCompanies);
    
    // Get or create access records for each company
    const accessData = await Promise.all(
      validCompanies.map(async (companyName) => {
        try {
          let access = await CompanyDashboardAccess.findOne({ companyName });
          
          if (!access) {
            // Create default access
            access = new CompanyDashboardAccess({
              companyName: companyName.trim(),
              dashboardAccess: {
                home: true,
                dashboard: true,
                craneOverview: false,
                elevatorOverview: false,
                craneDashboard: false,
                reports: true,
                addUsers: true,
                addDevices: true,
                subscription: true,
                settings: true
              }
            });
            await access.save();
            console.log('✅ Created access record for:', companyName);
          }
          
          return access;
        } catch (err) {
          console.error('❌ Error processing company:', companyName, err);
          return null;
        }
      })
    );

    // Filter out any null results
    const validAccessData = accessData.filter(access => access !== null);

    res.json({ companies: validAccessData });
  } catch (err) {
    console.error('Error fetching company dashboard access:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update company dashboard access
app.put("/api/company-dashboard-access/:companyName", authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;
    const { companyName } = req.params;
    const { dashboardAccess } = req.body;
    
    if (role !== 'superadmin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const access = await CompanyDashboardAccess.findOneAndUpdate(
      { companyName },
      { 
        dashboardAccess,
        lastUpdated: new Date(),
        updatedBy: req.user.email
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, access });
  } catch (err) {
    console.error('Error updating company dashboard access:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if user can access specific dashboard
app.get("/api/check-dashboard-access/:dashboardName", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    const { dashboardName } = req.params;
    
    if (role === 'superadmin') {
      return res.json({ hasAccess: true });
    }

    const access = await CompanyDashboardAccess.findOne({ companyName });
    
    if (!access) {
      return res.json({ hasAccess: false });
    }

    const hasAccess = access.dashboardAccess[dashboardName] || false;
    res.json({ hasAccess });
  } catch (err) {
    console.error('Error checking dashboard access:', err);
    res.status(500).json({ error: 'Internal server error' });
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

// ✅ API endpoint to get crane sessions data for PDF export
app.get('/api/crane/sessions', authenticateToken, async (req, res) => {
  try {
    const { cranes, months } = req.query;
    const { role, companyName } = req.user;

    console.log('🔍 User requesting crane sessions data:', { role, companyName, cranes, months });

    if (role !== 'superadmin' && role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin or superadmin required.' });
    }

    const selectedCranes = cranes ? cranes.split(',') : [];
    const selectedMonths = months ? months.split(',') : [];

    if (selectedCranes.length === 0) {
      return res.status(400).json({ message: 'No cranes selected' });
    }

    // Build company filter consistent with overview route
    const companyFilter = (role !== 'superadmin') ? { craneCompany: companyName } : {};

    const craneLogs = await CraneLog.find({
      ...companyFilter,
      DeviceID: { $in: selectedCranes }
    }).sort({ Timestamp: 1 });

    if (craneLogs.length === 0) {
      return res.json({ success: true, sessions: [], message: 'No crane logs found for selected cranes' });
    }

    const sessionsData = generateSessionsData(craneLogs, selectedCranes);

    res.json({ success: true, sessions: sessionsData, totalSessions: sessionsData.length, selectedCranes, selectedMonths });
  } catch (error) {
    console.error('❌ Error fetching crane sessions:', error);
    res.status(500).json({ message: 'Failed to fetch crane sessions data', error: error.message });
  }
});

// ✅ Filtered working totals for first card (safe, standalone)
app.get('/api/crane/working-totals', authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    const cranesParam = (req.query.cranes || '').trim();
    const selectedCranes = cranesParam ? cranesParam.split(',').map(s => s.trim()).filter(Boolean) : [];
    const startStr = (req.query.start || '').trim();
    const endStr = (req.query.end || '').trim();

    // Company filter matches overview logic
    const companyFilter = role !== 'superadmin' ? { craneCompany: companyName } : {};

    // ✅ Build allowlist from Device collection (admin = own company, superadmin = all)
    const deviceQuery = role !== 'superadmin' ? { companyName } : {};
    const allowedDevices = await Device.find(deviceQuery).lean();
    const allowedById = new Set(allowedDevices.map(d => d.deviceId));

    // ✅ Get all crane devices for this company, then filter by allowlist
    const craneDevicesRaw = await CraneLog.distinct('DeviceID', companyFilter);
    const craneDevices = craneDevicesRaw.filter(id => allowedById.has(id));
    
    // Determine crane list (only from allowed devices)
    const allCranes = craneDevices;
    const cranes = selectedCranes.length > 0 ? selectedCranes.filter(id => allowedById.has(id)) : allCranes;
    if (cranes.length === 0) {
      return res.json({ success: true, workingCompleted: 0, workingOngoing: 0, cranesCount: 0, cranesList: [], period: null });
    }

    // Determine period
    const now = getCurrentTimeInIST();
    let startDate, endDate;
    if (startStr && endStr) {
      // ✅ Fix: Create dates in IST timezone for proper comparison
      const [ys, ms, ds] = startStr.split('-').map(Number);
      const [ye, me, de] = endStr.split('-').map(Number);
      
      // ✅ Use helper function for consistent date boundaries
      const startDateObj = new Date(ys, ms - 1, ds);
      const endDateObj = new Date(ye, me - 1, de);
      startDate = getDateBoundary(startDateObj, true);  // 00:00:00 IST
      endDate = getDateBoundary(endDateObj, false);     // 23:59:59 IST
      
      console.log(`🔍 [working-totals] Date range created:`, {
        startStr,
        endStr,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        startDateIST: startDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        endDateIST: endDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      });
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      endDate = now;
    }

    let workingCompleted = 0;
    let workingOngoing = 0;

    for (const deviceId of cranes) {
      // ✅ Fetch all logs and filter in JavaScript for accurate date comparison
      const allLogs = await CraneLog.find({ 
        ...companyFilter, 
        DeviceID: deviceId
      }).lean().sort({ Timestamp: 1 });

      // Filter logs by date range in JavaScript
      let logs = allLogs;
      if (startStr && endStr) {
        logs = allLogs.filter(log => {
          // ✅ SIMPLE FIX: Use string-based date comparison to avoid timezone issues
          const logDate = log.Timestamp.split(' ')[0]; // Get date part only (DD/MM/YYYY)
          
          // Convert startStr (YYYY-MM-DD) to DD/MM/YYYY format for comparison
          const [year, month, day] = startStr.split('-').map(Number);
          const startDateFormatted = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
          
          // Convert endStr (YYYY-MM-DD) to DD/MM/YYYY format for comparison
          const [yearEnd, monthEnd, dayEnd] = endStr.split('-').map(Number);
          const endDateFormatted = `${dayEnd.toString().padStart(2, '0')}/${monthEnd.toString().padStart(2, '0')}/${yearEnd}`;
          
          // ✅ Debug: Log the comparison values
          if (allLogs.length <= 5) { // Only log for first few logs to avoid spam
            console.log(`🔍 [working-totals] String date comparison for ${deviceId}:`, {
              original: log.Timestamp,
              logDate: logDate,
              startDateFormatted: startDateFormatted,
              endDateFormatted: endDateFormatted,
              isAfterStart: logDate >= startDateFormatted,
              isBeforeEnd: logDate <= endDateFormatted,
              included: (logDate >= startDateFormatted && logDate <= endDateFormatted)
            });
          }
          
          return logDate >= startDateFormatted && logDate <= endDateFormatted;
        });
        
        // ✅ Debug logging
        console.log(`🔍 [working-totals] Date filter for ${deviceId}:`, {
          startStr,
          endStr,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          totalLogs: allLogs.length,
          filteredLogs: logs.length
        });
      }

      // ✅ Debug logging
      console.log(`🔍 [working-totals] Found ${logs.length} logs for ${deviceId} with date filter`);
      if (logs.length > 0) {
        console.log(`🔍 [working-totals] First log: ${logs[0].Timestamp}, Last log: ${logs[logs.length - 1].Timestamp}`);
      }

      if (logs.length === 0) continue;

      // ✅ Use the same working hours logic as overview endpoint
      let currentWorkingStart = null;
      let isCurrentlyWorking = false;

      // ✅ Carry-over detection: if the crane was already working at 00:00 today
      // look at the last log before the selected start date and infer status
      try {
        const lastBeforeStart = [...allLogs].reverse().find((entry) => {
          const ts = parseTimestamp(entry.Timestamp);
          return ts && ts < startDate;
        });
        const wasWorkingAtStart = !!(lastBeforeStart && lastBeforeStart.DigitalInput1 === "1" && lastBeforeStart.DigitalInput2 === "0");
        if (wasWorkingAtStart) {
          // The crane was working at midnight; start an ongoing session from 00:00:00
          currentWorkingStart = startDate;
          isCurrentlyWorking = true;
          console.log(`🔍 [working-totals] ${deviceId} carry-over detected: working at 00:00, initializing start from midnight`);
        }
      } catch (e) {
        console.log(`⚠️ [working-totals] ${deviceId} carry-over detection error:`, e?.message || e);
      }

      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const timestamp = parseTimestamp(log.Timestamp);
        if (!timestamp) continue;

        const isWorking = (log.DigitalInput1 === "1" && log.DigitalInput2 === "0");
        
        if (isWorking && !isCurrentlyWorking) {
          // Start of working period
          currentWorkingStart = timestamp;
          isCurrentlyWorking = true;
        } else if (!isWorking && isCurrentlyWorking) {
          // End of working period
          if (currentWorkingStart) {
            const duration = (timestamp - currentWorkingStart) / (1000 * 60 * 60); // hours
            workingCompleted += duration;
            currentWorkingStart = null;
          }
          isCurrentlyWorking = false;
        }
      }

      // ✅ FIX: Handle case where crane is already working from previous day
      // If crane is working but we don't have a start time, it means it's an ongoing session
      if (isCurrentlyWorking && !currentWorkingStart) {
        // Check if this might be an ongoing session from previous day
        const firstLog = logs[0];
        if (firstLog && firstLog.DigitalInput1 === "1" && firstLog.DigitalInput2 === "0") {
          // Crane was already working when first log was recorded today
          // This indicates an ongoing session from previous day
          currentWorkingStart = startDate; // Start counting from 12 AM today
          console.log(`🔍 [working-totals] ${deviceId} detected ongoing session from previous day, starting from 00:00:00`);
        }
      }

      // ✅ CRITICAL FIX: ALWAYS check if crane is working from before selected date
      // This handles the case where crane started working yesterday and is still working today
      if (isCurrentlyWorking && currentWorkingStart) {
        // Check if the working start time is before today's start date
        if (currentWorkingStart < startDate) {
          console.log(`🔍 [working-totals] ${deviceId} working session started before today (${currentWorkingStart.toISOString()}), forcing start to 00:00:00`);
          currentWorkingStart = startDate; // Force start to 12 AM today
        }
      }

      // ✅ DEBUG: Log the ongoing session detection
      console.log(`🔍 [working-totals] ${deviceId} ongoing session analysis:`, {
        isCurrentlyWorking,
        currentWorkingStart: currentWorkingStart ? currentWorkingStart.toISOString() : null,
        startDate: startDate.toISOString(),
        firstLogTimestamp: logs.length > 0 ? logs[0].Timestamp : 'No logs',
        lastLogTimestamp: logs.length > 0 ? logs[logs.length - 1].Timestamp : 'No logs'
      });



      // ✅ Handle ongoing working session with proper cross-day logic
      if (isCurrentlyWorking && currentWorkingStart) {
        let effectiveStart;
        let effectiveEnd;
        
        // ✅ Check if this is a cross-day ongoing session
        if (currentWorkingStart < startDate) {
          // ✅ Crane was working before selected date - start counting from 12 AM of selected date
          effectiveStart = startDate;
          console.log(`🔍 [working-totals] ${deviceId} has ongoing session from before ${startStr}, counting from 00:00:00`);
        } else {
          // ✅ Normal ongoing session within selected date range
          effectiveStart = currentWorkingStart;
        }
        
        // ✅ CRITICAL FIX: For historical dates, cap ongoing hours at end of selected date
        // For today's date, use current time (not end of day)
        if (endDate < now) {
          // This is a historical date, not today - cap at end of selected date
          effectiveEnd = endDate;
          console.log(`🔍 [working-totals] ${deviceId} historical date selected, capping ongoing hours at ${endStr} 23:59:59`);
        } else {
          // This is today or future date - use current time
          effectiveEnd = now;
          console.log(`🔍 [working-totals] ${deviceId} today's date selected, using current time: ${now.toLocaleString('en-IN')}`);
        }
        
        // ✅ Calculate duration from effective start to effective end
        const effectiveStartIST = new Date(effectiveStart.getTime() + (5.5 * 60 * 60 * 1000));
        const effectiveEndIST = new Date(effectiveEnd.getTime() + (5.5 * 60 * 60 * 1000));
        const duration = (effectiveEndIST - effectiveStartIST) / (1000 * 60 * 60); // hours
        workingOngoing += duration;
        
        // ✅ DEBUG: Detailed ongoing session calculation with raw values
        console.log(`🔍 [working-totals] ${deviceId} ongoing session calculation:`, {
          effectiveStart: effectiveStart.toISOString(),
          effectiveStartIST: effectiveStartIST.toLocaleString('en-IN'),
          effectiveEnd: effectiveEnd.toISOString(),
          effectiveEndIST: effectiveEndIST.toLocaleString('en-IN'),
          durationHours: duration.toFixed(2),
          durationMinutes: (duration * 60).toFixed(0),
          durationMinutesRaw: (duration * 60),
          isToday: endDate >= now,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          currentTime: now.toISOString(),
          workingOngoingAccumulated: workingOngoing.toFixed(4)
        });
      }
    }

    res.json({
      success: true,
      workingCompleted: Math.round(workingCompleted * 100) / 100,
      workingOngoing: Math.round(workingOngoing * 100) / 100,
      cranesCount: cranes.length,
      cranesList: cranes,
      period: { start: startDate.toISOString(), end: endDate.toISOString() }
    });
  } catch (err) {
    console.error('❌ working-totals error:', err);
    res.status(500).json({ success: false, message: 'Failed to compute working totals' });
  }
});

// ✅ Flexible time-series stats (EARLY, before static)
app.get("/api/crane/timeseries-stats", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    const { cranes, start, end, granularity } = req.query;
    
    // ✅ Filter by company (except for superadmin)
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};
    
    // ✅ Build allowlist from Device collection (admin = own company, superadmin = all)
    const deviceQuery = role !== "superadmin" ? { companyName } : {};
    const allowedDevices = await Device.find(deviceQuery).lean();
    const allowedById = new Set(allowedDevices.map(d => d.deviceId));
    
    // ✅ Get unique crane devices for this company, then filter by allowlist
    const craneDevicesRaw = await CraneLog.distinct("DeviceID", companyFilter);
    const craneDevices = craneDevicesRaw.filter(id => allowedById.has(id));
    
    const requested = (cranes || "").split(',').map(s => s.trim()).filter(Boolean);
    const selectedDevices = requested.length > 0 ? craneDevices.filter(id => requested.includes(id)) : craneDevices;
    if (selectedDevices.length === 0) return res.json({ granularity: "monthly", points: [] });
    const toStartOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const toEndOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
    const now = getCurrentTimeInIST();
    let rangeStart, rangeEnd;
    if (start && end) {
      const [ys, ms, ds] = start.split('-').map(Number);
      const [ye, me, de] = end.split('-').map(Number);
      rangeStart = new Date(ys, ms - 1, ds, 0, 0, 0);
      rangeEnd = new Date(ye, me - 1, de, 23, 59, 59);
      if (rangeEnd > now) rangeEnd = now;
    } else {
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      rangeStart = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1, 0, 0, 0);
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }
    if (rangeStart > rangeEnd) return res.json({ granularity: "monthly", points: [] });
    const msPerDay = 24 * 60 * 60 * 1000;
    const rangeDays = Math.max(1, Math.ceil((toStartOfDay(rangeEnd) - toStartOfDay(rangeStart)) / msPerDay) + 1);
    let mode = (granularity || 'auto').toLowerCase();
    if (mode === 'auto') {
      if (rangeDays <= 31) mode = 'daily';
      else if (rangeDays <= 180) mode = 'weekly';
      else mode = 'monthly';
    }
    const buckets = [];
    if (mode === 'daily') {
      let cursor = toStartOfDay(rangeStart);
      while (cursor <= rangeEnd) {
        const dayStart = toStartOfDay(cursor);
        const dayEnd = toEndOfDay(cursor);
        buckets.push({ start: dayStart, end: dayEnd, label: dayStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) });
        cursor = new Date(cursor.getTime() + msPerDay);
      }
    } else if (mode === 'weekly') {
      let cursor = toStartOfDay(rangeStart);
      while (cursor <= rangeEnd) {
        const weekStart = toStartOfDay(cursor);
        const weekEnd = toEndOfDay(new Date(cursor.getTime() + 6 * msPerDay));
        buckets.push({ start: weekStart, end: weekEnd > rangeEnd ? rangeEnd : weekEnd, label: `Week of ${weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` });
        cursor = new Date(cursor.getTime() + 7 * msPerDay);
      }
    } else {
      let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      const lastMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
      while (cursor <= lastMonth) {
        const ms = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const me = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
        const label = `${ms.toLocaleString('default', { month: 'short' })} ${ms.getFullYear()}`;
        buckets.push({ start: ms, end: me > rangeEnd ? rangeEnd : me, label });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    }
    // Precompute periods per device across the whole range, then clip to each bucket
    const devicePeriods = {};
    for (const deviceId of selectedDevices) {
      const deviceLogs = await CraneLog.find({ ...companyFilter, DeviceID: deviceId }).lean();
      // ✅ Sort full device logs once
      const sortedDeviceLogs = deviceLogs.sort((a, b2) => {
        const [ad, at] = a.Timestamp.split(' ');
        const [ad1, am1, ay1] = ad.split('/').map(Number);
        const [ah, ami, as] = at.split(':').map(Number);
        const aT = new Date(ay1, am1 - 1, ad1, ah, ami, as);
        const [bd, bt] = b2.Timestamp.split(' ');
        const [bd1, bm1, by1] = bd.split('/').map(Number);
        const [bh, bmi, bs] = bt.split(':').map(Number);
        const bT = new Date(by1, bm1 - 1, bd1, bh, bmi, bs);
        return aT - bT;
      });
      // ✅ Build periods from full history so cross-midnight carry-over is preserved
      devicePeriods[deviceId] = {
        working: calculateConsecutivePeriods(sortedDeviceLogs, 'working'),
        maintenance: calculateConsecutivePeriods(sortedDeviceLogs, 'maintenance')
      };
    }

    const points = [];
    for (const b of buckets) {
      let usage = 0, maint = 0;
      for (const deviceId of selectedDevices) {
        const periods = devicePeriods[deviceId] || { working: [], maintenance: [] };
        for (const p of periods.working) {
          const startClip = p.startTime < b.start ? b.start : p.startTime;
          const pEnd = p.isOngoing ? (getCurrentTimeInIST() < b.end ? getCurrentTimeInIST() : b.end) : p.endTime;
          const endClip = pEnd > b.end ? b.end : pEnd;
          if (endClip > startClip) usage += calculatePeriodDuration(startClip, endClip, false);
        }
        for (const p of periods.maintenance) {
          const startClip = p.startTime < b.start ? b.start : p.startTime;
          const pEnd = p.isOngoing ? (getCurrentTimeInIST() < b.end ? getCurrentTimeInIST() : b.end) : p.endTime;
          const endClip = pEnd > b.end ? b.end : pEnd;
          if (endClip > startClip) maint += calculatePeriodDuration(startClip, endClip, false);
        }
      }
      points.push({ label: b.label, usageHours: Math.round(usage * 100) / 100, maintenanceHours: Math.round(maint * 100) / 100 });
    }
    return res.json({ granularity: mode, points });
  } catch (err) {
    console.error("❌ Timeseries stats fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
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

// Removed duplicate late sessions route (handled by EARLY route above)

// removed duplicate early sessions route

// ✅ EARLY SESSIONS API (must be before static and catch-all routes)
app.get('/api/crane/sessions', authenticateToken, async (req, res) => {
  try {
    const { cranes, months } = req.query;
    const { role, companyName } = req.user;

    console.log('🔍 [EARLY] User requesting crane sessions data:', { role, companyName, cranes, months });

    if (role !== 'superadmin' && role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin or superadmin required.' });
    }

    const selectedCranes = cranes ? cranes.split(',') : [];
    const selectedMonths = months ? months.split(',') : [];

    if (selectedCranes.length === 0) {
      return res.status(400).json({ message: 'No cranes selected' });
    }

    // Build company filter consistent with overview route
    const companyFilter = (role !== 'superadmin') ? { craneCompany: companyName } : {};

    const craneLogs = await CraneLog.find({
      ...companyFilter,
      DeviceID: { $in: selectedCranes }
    }).sort({ Timestamp: 1 });

    if (craneLogs.length === 0) {
      return res.json({ success: true, sessions: [], message: 'No crane logs found for selected cranes' });
    }

    const sessionsData = generateSessionsData(craneLogs, selectedCranes);

    res.json({ success: true, sessions: sessionsData, totalSessions: sessionsData.length, selectedCranes, selectedMonths });
  } catch (error) {
    console.error('❌ [EARLY] Error fetching crane sessions:', error);
    res.status(500).json({ message: 'Failed to fetch crane sessions data', error: error.message });
  }
});

// ✅ GET: Flexible time-series stats for line chart (daily/weekly/monthly)
app.get("/api/crane/timeseries-stats", authenticateToken, async (req, res) => {
  try {
    const { role, companyName } = req.user;
    const { cranes, start, end, granularity } = req.query;

    // Company scope
    const companyFilter = role !== "superadmin" ? { craneCompany: companyName } : {};

    // Devices
    const allDevices = await CraneLog.distinct("DeviceID", companyFilter);
    const requested = (cranes || "").split(',').map(s => s.trim()).filter(Boolean);
    const selectedDevices = requested.length > 0 ? allDevices.filter(id => requested.includes(id)) : allDevices;
    if (selectedDevices.length === 0) return res.json({ granularity: "monthly", points: [] });

    // Date helpers
    const toStartOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const toEndOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

    // Range
    const now = getCurrentTimeInIST();
    let rangeStart, rangeEnd;
    if (start && end) {
      const [ys, ms, ds] = start.split('-').map(Number);
      const [ye, me, de] = end.split('-').map(Number);
      rangeStart = new Date(ys, ms - 1, ds, 0, 0, 0);
      rangeEnd = new Date(ye, me - 1, de, 23, 59, 59);
      if (rangeEnd > now) rangeEnd = now;
    } else {
      // Default: last 6 months monthly buckets
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      rangeStart = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1, 0, 0, 0);
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }
    if (rangeStart > rangeEnd) return res.json({ granularity: "monthly", points: [] });

    // Decide granularity
    const msPerDay = 24 * 60 * 60 * 1000;
    const rangeDays = Math.max(1, Math.ceil((toStartOfDay(rangeEnd) - toStartOfDay(rangeStart)) / msPerDay) + 1);
    let mode = (granularity || 'auto').toLowerCase();
    if (mode === 'auto') {
      if (rangeDays <= 31) mode = 'daily';
      else if (rangeDays <= 180) mode = 'weekly';
      else mode = 'monthly';
    }

    // Build buckets
    const buckets = [];
    if (mode === 'daily') {
      let cursor = toStartOfDay(rangeStart);
      while (cursor <= rangeEnd) {
        const dayStart = toStartOfDay(cursor);
        const dayEnd = toEndOfDay(cursor);
        buckets.push({ start: dayStart, end: dayEnd, label: dayStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) });
        cursor = new Date(cursor.getTime() + msPerDay);
      }
    } else if (mode === 'weekly') {
      // Buckets of 7 days starting at rangeStart
      let cursor = toStartOfDay(rangeStart);
      while (cursor <= rangeEnd) {
        const weekStart = toStartOfDay(cursor);
        const weekEnd = toEndOfDay(new Date(cursor.getTime() + 6 * msPerDay));
        buckets.push({ start: weekStart, end: weekEnd > rangeEnd ? rangeEnd : weekEnd, label: `Week of ${weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` });
        cursor = new Date(cursor.getTime() + 7 * msPerDay);
      }
    } else {
      // monthly
      let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
      const lastMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
      while (cursor <= lastMonth) {
        const ms = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const me = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
        const label = `${ms.toLocaleString('default', { month: 'short' })} ${ms.getFullYear()}`;
        buckets.push({ start: ms, end: me > rangeEnd ? rangeEnd : me, label });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    }

    const points = [];

    // Aggregate by bucket
    for (const b of buckets) {
      let usage = 0;
      let maint = 0;

      for (const deviceId of selectedDevices) {
        const deviceFilter = { ...companyFilter, DeviceID: deviceId };
        const deviceLogs = await CraneLog.find(deviceFilter).lean();

        const bucketLogs = deviceLogs.filter(log => {
          try {
            const [datePart, timePart] = log.Timestamp.split(' ');
            const [d, m, y] = datePart.split('/').map(Number);
            const [hh, mm, ss] = timePart.split(':').map(Number);
            const t = new Date(y, m - 1, d, hh, mm, ss);
            return t >= b.start && t <= b.end;
          } catch (e) { return false; }
        });
        if (bucketLogs.length === 0) continue;

        bucketLogs.sort((a, b2) => {
          const [ad, at] = a.Timestamp.split(' ');
          const [ad1, am1, ay1] = ad.split('/').map(Number);
          const [ah, ami, as] = at.split(':').map(Number);
          const aT = new Date(ay1, am1 - 1, ad1, ah, ami, as);
          const [bd, bt] = b2.Timestamp.split(' ');
          const [bd1, bm1, by1] = bd.split('/').map(Number);
          const [bh, bmi, bs] = bt.split(':').map(Number);
          const bT = new Date(by1, bm1 - 1, bd1, bh, bmi, bs);
          return aT - bT;
        });

        const workingPeriods = calculateConsecutivePeriods(bucketLogs, 'working');
        for (const p of workingPeriods) {
          if (p.isOngoing) {
            const effectiveStart = p.startTime < b.start ? b.start : p.startTime;
            let endClamp = getCurrentTimeInIST();
            if (endClamp > b.end) endClamp = b.end;
            const duration = calculatePeriodDuration(effectiveStart, endClamp, true);
            usage += duration;
          } else {
            const effectiveStart = p.startTime < b.start ? b.start : p.startTime;
            const effectiveEnd = p.endTime > b.end ? b.end : p.endTime;
            const duration = calculatePeriodDuration(effectiveStart, effectiveEnd, false);
            usage += duration;
          }
        }

        const maintenancePeriods = calculateConsecutivePeriods(bucketLogs, 'maintenance');
        for (const p of maintenancePeriods) {
          if (p.isOngoing) {
            const effectiveStart = p.startTime < b.start ? b.start : p.startTime;
            let endClamp = getCurrentTimeInIST();
            if (endClamp > b.end) endClamp = b.end;
            const duration = calculatePeriodDuration(effectiveStart, endClamp, true);
            maint += duration;
          } else {
            const effectiveStart = p.startTime < b.start ? b.start : p.startTime;
            const effectiveEnd = p.endTime > b.end ? b.end : p.endTime;
            const duration = calculatePeriodDuration(effectiveStart, effectiveEnd, false);
            maint += duration;
          }
        }
      }

      points.push({ label: b.label, usageHours: Math.round(usage * 100) / 100, maintenanceHours: Math.round(maint * 100) / 100 });
    }

    return res.json({ granularity: mode, points });
  } catch (err) {
    console.error("❌ Timeseries stats fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
