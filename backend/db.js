const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri || uri.trim() === '') {
    console.error('❌ MongoDB Connection Failed: MONGO_URI is not set in environment (check Azure Application Settings)');
    process.exit(1);
  }

  try {
    // ✅ family: 4 = use IPv4 only — Azure App Service often fails IPv6 routes to Atlas (ReplicaSetNoPrimary / Unknown servers)
    await mongoose.connect(uri, {
      family: 4,
      serverSelectionTimeoutMS: 45000,
    });
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB Connection Failed:', err.message);
    if (err.code) console.error('   Error code:', err.code);
    if (err.reason) console.error('   Reason:', err.reason);
    process.exit(1);
  }
};

module.exports = connectDB;
