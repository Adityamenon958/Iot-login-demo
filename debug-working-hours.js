const mongoose = require('mongoose');
const CraneLog = require('./backend/models/CraneLog');

// MongoDB connection string
const MONGODB_URI = 'mongodb+srv://adityamenon958:Rekham123%40@cluster1.vldir5y.mongodb.net/dashboardDB?retryWrites=true&w=majority&appName=Cluster1';

async function debugWorkingHours() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    // Connect with longer timeout and better options
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000, // 30 seconds
      socketTimeoutMS: 45000, // 45 seconds
      bufferCommands: false
    });
    
    console.log('✅ Connected to MongoDB');

    // Test 1: Basic connection test
    console.log('\n🧪 Test 1: Basic connection test...');
    const adminDb = mongoose.connection.db.admin();
    const result = await adminDb.ping();
    console.log('✅ Database ping successful:', result);

    // Test 2: List collections
    console.log('\n🧪 Test 2: List collections...');
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('✅ Collections found:', collections.map(c => c.name));

    // Test 3: Try to find just ONE document
    console.log('\n🧪 Test 3: Find one document...');
    const oneLog = await CraneLog.findOne().lean();
    if (oneLog) {
      console.log('✅ Found one document:');
      console.log('  DeviceID:', oneLog.DeviceID);
      console.log('  Timestamp:', oneLog.Timestamp);
      console.log('  DI1:', oneLog.DigitalInput1);
      console.log('  DI2:', oneLog.DigitalInput2);
      console.log('  Maintenance:', oneLog.maintenance);
    } else {
      console.log('❌ No documents found in collection');
    }

    // Test 4: Try with a very small limit
    console.log('\n🧪 Test 4: Find 5 documents with limit...');
    const fewLogs = await CraneLog.find().limit(5).lean();
    console.log(`✅ Found ${fewLogs.length} documents`);

    if (fewLogs.length > 0) {
      // Test 5: Check if we can filter by date
      console.log('\n🧪 Test 5: Try date filtering on small dataset...');
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const recentLogs = await CraneLog.find({
        Timestamp: { $gte: oneDayAgo }
      }).limit(10).lean();
      
      console.log(`✅ Found ${recentLogs.length} recent documents (last 24 hours)`);
      
      if (recentLogs.length > 0) {
        // Test 6: Calculate working hours for just today
        console.log('\n🧪 Test 6: Calculate working hours for last 24 hours...');
        calculateWorkingHours(recentLogs, now);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('timeout')) {
      console.log('\n💡 Database timeout detected. Possible causes:');
      console.log('1. MongoDB Atlas cluster is overloaded');
      console.log('2. Network connectivity issues');
      console.log('3. Database indexes are missing');
      console.log('4. Collection is extremely large');
      console.log('5. MongoDB Atlas tier is too small for the data size');
    }
    
    if (error.message.includes('ping')) {
      console.log('\n💡 Database ping failed. Check:');
      console.log('1. MongoDB Atlas cluster status');
      console.log('2. Network firewall settings');
      console.log('3. Connection string validity');
    }
  } finally {
    try {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    } catch (e) {
      console.log('⚠️  Error disconnecting:', e.message);
    }
  }
}

function calculateWorkingHours(logs, now) {
  console.log(`\n📊 Processing ${logs.length} logs for working hours calculation...`);
  
  // Group by device
  const deviceGroups = {};
  logs.forEach(log => {
    if (!deviceGroups[log.DeviceID]) {
      deviceGroups[log.DeviceID] = [];
    }
    deviceGroups[log.DeviceID].push(log);
  });

  console.log(`🏗️  Devices found: ${Object.keys(deviceGroups).length}`);
  
  Object.keys(deviceGroups).forEach(deviceId => {
    const deviceLogs = deviceGroups[deviceId];
    console.log(`\n🔧 Device: ${deviceId} (${deviceLogs.length} logs)`);
    
    // Sort by timestamp
    deviceLogs.sort((a, b) => a.Timestamp - b.Timestamp);
    
    let workingPeriods = [];
    let currentPeriod = null;
    
    for (let i = 0; i < deviceLogs.length; i++) {
      const log = deviceLogs[i];
      const isWorking = log.DigitalInput1 === "1" && log.DigitalInput2 === "0";
      
      if (isWorking && !currentPeriod) {
        // Start new working period
        currentPeriod = {
          start: log.Timestamp,
          startLog: log
        };
      } else if (!isWorking && currentPeriod) {
        // End working period
        currentPeriod.end = log.Timestamp;
        currentPeriod.endLog = log;
        currentPeriod.duration = (currentPeriod.end - currentPeriod.start) / (1000 * 60 * 60); // hours
        workingPeriods.push(currentPeriod);
        currentPeriod = null;
      }
    }
    
    // Handle ongoing period
    if (currentPeriod) {
      currentPeriod.end = now;
      currentPeriod.duration = (currentPeriod.end - currentPeriod.start) / (1000 * 60 * 60);
      currentPeriod.isOngoing = true;
      workingPeriods.push(currentPeriod);
    }
    
    // Calculate totals
    const totalCompletedHours = workingPeriods
      .filter(p => !p.isOngoing)
      .reduce((sum, p) => sum + p.duration, 0);
    
    const ongoingHours = workingPeriods
      .filter(p => p.isOngoing)
      .reduce((sum, p) => sum + p.duration, 0);
    
    const totalHours = totalCompletedHours + ongoingHours;
    
    console.log(`  Working Periods: ${workingPeriods.length}`);
    console.log(`  Completed Hours: ${totalCompletedHours.toFixed(2)}h`);
    console.log(`  Ongoing Hours: ${ongoingHours.toFixed(2)}h`);
    console.log(`  Total Working Hours: ${totalHours.toFixed(2)}h`);
  });
}

// Run the debug function
debugWorkingHours();
