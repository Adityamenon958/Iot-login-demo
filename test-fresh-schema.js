const mongoose = require('mongoose');

// MongoDB connection string
const MONGODB_URI = 'mongodb+srv://adityamenon958:Rekham123%40@cluster1.vldir5y.mongodb.net/dashboardDB?retryWrites=true&w=majority&appName=Cluster1';

async function testFreshSchema() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    });
    
    console.log('✅ Connected to MongoDB');

    console.log('\n🧪 Testing with completely fresh schema...');
    
    // Create a brand new schema instance
    const FreshCraneLogSchema = new mongoose.Schema({
      craneCompany: String,
      DeviceID: String,
      Uid: String,
      Timestamp: Date,
      Longitude: String,
      Latitude: String,
      DigitalInput1: String,
      DigitalInput2: String,
      maintenance: String
    }, { 
      timestamps: true,
      collection: 'cranelogs',
      strict: false
    });

    // Add minimal indexes
    FreshCraneLogSchema.index({ Timestamp: -1 });

    // Create a new model with a unique name
    const FreshCraneLog = mongoose.model('FreshCraneLog', FreshCraneLogSchema);

    // Test 1: Basic findOne
    console.log('\n📊 Test 1: Fresh schema findOne...');
    try {
      const startTime = Date.now();
      const doc = await FreshCraneLog.findOne().lean();
      const endTime = Date.now();
      console.log(`✅ Fresh schema query successful in ${endTime - startTime}ms`);
      console.log('  Document found:', doc ? 'Yes' : 'No');
      if (doc) {
        console.log('  DeviceID:', doc.DeviceID);
        console.log('  Timestamp:', doc.Timestamp);
        console.log('  DI1:', doc.DigitalInput1);
        console.log('  DI2:', doc.DigitalInput2);
      }
    } catch (error) {
      console.log('❌ Fresh schema query failed:', error.message);
    }

    // Test 2: Working hours calculation for current month
    console.log('\n📊 Test 2: Working hours for current month...');
    try {
      const startTime = Date.now();
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      console.log('  Date range:', currentMonthStart.toISOString(), 'to', now.toISOString());
      
      const logs = await FreshCraneLog.find({
        Timestamp: { $gte: currentMonthStart, $lte: now }
      }).sort({Timestamp: 1}).lean();
      
      console.log(`  Found ${logs.length} logs for current month`);
      
      // Calculate working hours
      let workingPeriods = [];
      let currentPeriod = null;
      
      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const isWorking = log.DigitalInput1 === "1" && log.DigitalInput2 === "0";
        
        if (isWorking && !currentPeriod) {
          currentPeriod = { start: log.Timestamp };
        } else if (!isWorking && currentPeriod) {
          currentPeriod.end = log.Timestamp;
          currentPeriod.duration = (currentPeriod.end - currentPeriod.start) / (1000 * 60 * 60);
          workingPeriods.push(currentPeriod);
          currentPeriod = null;
        }
      }
      
      if (currentPeriod) {
        currentPeriod.end = now;
        currentPeriod.duration = (currentPeriod.end - currentPeriod.start) / (1000 * 60 * 60);
        workingPeriods.push(currentPeriod);
      }
      
      const totalHours = workingPeriods.reduce((sum, p) => sum + p.duration, 0);
      
      const endTime = Date.now();
      console.log(`✅ Working hours calculation successful in ${endTime - startTime}ms`);
      console.log('  Working periods:', workingPeriods.length);
      console.log('  Total working hours:', totalHours.toFixed(2), 'h');
      
      // Show first few periods
      workingPeriods.slice(0, 3).forEach((period, index) => {
        const startTime = period.start.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        const endTime = period.end.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        console.log(`    Period ${index + 1}: ${startTime} → ${endTime} (${period.duration.toFixed(2)}h)`);
      });
      
    } catch (error) {
      console.log('❌ Working hours calculation failed:', error.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    try {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    } catch (e) {
      console.log('⚠️  Error disconnecting:', e.message);
    }
  }
}

// Run the function
testFreshSchema();
