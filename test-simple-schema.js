const mongoose = require('mongoose');

// MongoDB connection string
const MONGODB_URI = 'mongodb+srv://adityamenon958:Rekham123%40@cluster1.vldir5y.mongodb.net/dashboardDB?retryWrites=true&w=majority&appName=Cluster1';

async function testSimpleSchema() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    });
    
    console.log('✅ Connected to MongoDB');

    console.log('\n🧪 Testing with simplified CraneLog schema...');
    
    // Create a simplified schema without pre-save hooks
    const SimpleCraneLogSchema = new mongoose.Schema({
      craneCompany: String,
      DeviceID: String,
      Uid: String,
      Timestamp: Date,
      Longitude: String,
      Latitude: String,
      DigitalInput1: String,
      DigitalInput2: String
    }, { 
      timestamps: true,
      collection: 'cranelogs',
      strict: false // Allow extra fields
    });

    // Add only essential indexes
    SimpleCraneLogSchema.index({ Timestamp: -1 });
    SimpleCraneLogSchema.index({ DeviceID: 1 });

    const SimpleCraneLog = mongoose.model('SimpleCraneLog', SimpleCraneLogSchema);

    // Test 1: Simple findOne
    console.log('\n📊 Test 1: Simple findOne...');
    try {
      const startTime = Date.now();
      const doc = await SimpleCraneLog.findOne().lean();
      const endTime = Date.now();
      console.log(`✅ Simple schema query successful in ${endTime - startTime}ms`);
      console.log('  Document found:', doc ? 'Yes' : 'No');
      if (doc) {
        console.log('  DeviceID:', doc.DeviceID);
        console.log('  Timestamp:', doc.Timestamp);
        console.log('  DI1:', doc.DigitalInput1);
        console.log('  DI2:', doc.DigitalInput2);
      }
    } catch (error) {
      console.log('❌ Simple schema query failed:', error.message);
    }

    // Test 2: Find with date filter
    console.log('\n📊 Test 2: Find with date filter...');
    try {
      const startTime = Date.now();
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const docs = await SimpleCraneLog.find({
        Timestamp: { $gte: oneDayAgo }
      }).limit(5).lean();
      
      const endTime = Date.now();
      console.log(`✅ Date filter query successful in ${endTime - startTime}ms`);
      console.log('  Documents found:', docs.length);
    } catch (error) {
      console.log('❌ Date filter query failed:', error.message);
    }

    // Test 3: Count documents
    console.log('\n📊 Test 3: Count documents...');
    try {
      const startTime = Date.now();
      const count = await SimpleCraneLog.countDocuments();
      const endTime = Date.now();
      console.log(`✅ Count query successful in ${endTime - startTime}ms`);
      console.log('  Total documents:', count);
    } catch (error) {
      console.log('❌ Count query failed:', error.message);
    }

    // Test 4: Working hours calculation
    console.log('\n📊 Test 4: Working hours calculation...');
    try {
      const startTime = Date.now();
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const logs = await SimpleCraneLog.find({
        Timestamp: { $gte: oneDayAgo }
      }).sort({Timestamp: 1}).lean();
      
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
testSimpleSchema();
