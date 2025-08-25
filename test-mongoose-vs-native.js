const mongoose = require('mongoose');

// MongoDB connection string
const MONGODB_URI = 'mongodb+srv://adityamenon958:Rekham123%40@cluster1.vldir5y.mongodb.net/dashboardDB?retryWrites=true&w=majority&appName=Cluster1';

async function testMongooseVsNative() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    });
    
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    console.log('\n🧪 Testing Native MongoDB vs Mongoose...');
    
    // Test 1: Native MongoDB query
    console.log('\n📊 Test 1: Native MongoDB findOne...');
    try {
      const startTime = Date.now();
      const nativeDoc = await db.collection('cranelogs').findOne();
      const endTime = Date.now();
      console.log(`✅ Native query successful in ${endTime - startTime}ms`);
      console.log('  Document found:', nativeDoc ? 'Yes' : 'No');
      if (nativeDoc) {
        console.log('  DeviceID:', nativeDoc.DeviceID);
        console.log('  Timestamp type:', typeof nativeDoc.Timestamp);
        console.log('  Timestamp value:', nativeDoc.Timestamp);
      }
    } catch (error) {
      console.log('❌ Native query failed:', error.message);
    }

    // Test 2: Mongoose query (without model)
    console.log('\n📊 Test 2: Mongoose connection findOne...');
    try {
      const startTime = Date.now();
      const mongooseDoc = await mongoose.connection.db.collection('cranelogs').findOne();
      const endTime = Date.now();
      console.log(`✅ Mongoose connection query successful in ${endTime - startTime}ms`);
      console.log('  Document found:', mongooseDoc ? 'Yes' : 'No');
    } catch (error) {
      console.log('❌ Mongoose connection query failed:', error.message);
    }

    // Test 3: Mongoose model query (this is what's failing)
    console.log('\n📊 Test 3: Mongoose model findOne...');
    try {
      const startTime = Date.now();
      
      // Import the model here to test
      const CraneLog = require('./backend/models/CraneLog');
      
      const modelDoc = await CraneLog.findOne().lean();
      const endTime = Date.now();
      console.log(`✅ Mongoose model query successful in ${endTime - startTime}ms`);
      console.log('  Document found:', modelDoc ? 'Yes' : 'No');
      if (modelDoc) {
        console.log('  DeviceID:', modelDoc.DeviceID);
        console.log('  Timestamp type:', typeof modelDoc.Timestamp);
        console.log('  Timestamp value:', modelDoc.Timestamp);
      }
    } catch (error) {
      console.log('❌ Mongoose model query failed:', error.message);
      console.log('  Error details:', error);
    }

    // Test 4: Check if it's a schema validation issue
    console.log('\n📊 Test 4: Testing with minimal schema...');
    try {
      const startTime = Date.now();
      
      // Create a minimal schema without validation
      const MinimalSchema = new mongoose.Schema({}, { strict: false });
      const MinimalModel = mongoose.model('MinimalCraneLog', MinimalSchema, 'cranelogs');
      
      const minimalDoc = await MinimalModel.findOne().lean();
      const endTime = Date.now();
      console.log(`✅ Minimal schema query successful in ${endTime - startTime}ms`);
      console.log('  Document found:', minimalDoc ? 'Yes' : 'No');
    } catch (error) {
      console.log('❌ Minimal schema query failed:', error.message);
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
testMongooseVsNative();
