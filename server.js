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

const app = express();
const PORT = process.env.PORT || 8080;

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
        secure: true,
        sameSite: 'None',
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
    secure: true,
    sameSite: 'None',
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
      const razorSub = await razorpay.subscriptions.fetch(user.subscriptionId);

      // ❌ If cancelled or not active
      const now = new Date();
      const oneMonthLater = new Date(user.subscriptionStart);
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

      if (
        razorSub.status !== 'active' ||
        now > oneMonthLater
      ) {
        user.subscriptionStatus = 'inactive';
        await user.save();
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

// ✅ Level Sensor
// ✅ POST: Store sensor data from TRB245

/* 🚀 INSERT SENSOR DATA */
app.post('/api/levelsensor', async (req, res) => {
  try {
    if (!req.body) return res.status(400).json({ message: 'Empty payload' });

    const {
      D        = null,
      uid      = null,
      level    = null,
      ts       = null,
      data     = null,
      address  = null,
      vehicleNo = null
    } = req.body;

    /* ⭐ 1. Convert “DD/MM/YYYY HH:mm:ss” → ISO Date for indexing */
    let dateISO = null;
    if (typeof D === 'string' && D.includes('/')) {
      const [datePart, timePart = '00:00:00'] = D.split(' ');
      const [day, month, year] = datePart.split('/').map(Number);
      const [h, m, s] = timePart.split(':').map(Number);
      dateISO = new Date(year, month - 1, day, h, m, s);
    }

    /* ⭐ 2. Store company name for this uid (used in GET filtering) */
    let companyUid = null;
    const dev = await Device.findOne({ uid }).lean();
    if (dev) companyUid = dev.companyName || null;

    /* ⭐ 3. Save the document */
    const sensorDoc = new LevelSensor({
      D,
      uid,
      level,
      ts,
      address,
      vehicleNo,
      data: Array.isArray(data) ? data : data === undefined ? [] : [data],
      dateISO,
      companyUid
    });

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
    const column = (req.query.column || '').trim();          // e.g. “vehicleNo”
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

    /* 4. Search filter */
    if (search) {
      const rx = new RegExp(search, 'i');
      if (column) {
        mongoFilter[column] = rx;
      } else {
        mongoFilter.$or = [
          { D: rx },
          { address: rx },
          { vehicleNo: rx },
          { uid: rx }
        ];
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
        secure: true,
        sameSite: 'Strict',
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
        console.warn("⚠️ Failed to fetch Razorpay subscription:", err.message);
        user.subscriptionStatus = 'inactive';
        await user.save();
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
      { expiresIn: '1h' }
    );

    res
      .cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: 60 * 60 * 1000,
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



// ✅ Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
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
