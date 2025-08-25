const mongoose = require('mongoose');
require('dotenv').config();

// 🔌 Test the exact import pattern used in server.js
console.log('🔍 Testing exact server.js import pattern...');

// Test 1: Import the model exactly like server.js
console.log('\n📊 Test 1: Importing CraneLog model...');
const CraneLog = require("./backend/models/CraneLog");
console.log('✅ Model imported successfully');
console.log('Model type:', typeof CraneLog);
console.log('Model name:', CraneLog.modelName);
console.log('Collection name:', CraneLog.collection.name);

// Test 2: Check if we can access the schema
console.log('\n📊 Test 2: Checking schema...');
console.log('Schema fields:', Object.keys(CraneLog.schema.paths));
console.log('Timestamp field type:', CraneLog.schema.paths.Timestamp.instance);

// Test 3: Try to connect and query
async function testConnection() {
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // Test 4: Try a simple query
    console.log('\n📊 Test 4: Testing simple query...');
    const count = await CraneLog.countDocuments();
    console.log('✅ Count query successful:', count);

    // Test 5: Try to find one document
    console.log('\n📊 Test 5: Testing findOne query...');
    const doc = await CraneLog.findOne().lean();
    if (doc) {
      console.log('✅ FindOne query successful');
      console.log('Document ID:', doc._id);
      console.log('Timestamp type:', typeof doc.Timestamp);
      console.log('Timestamp value:', doc.Timestamp);
      if (doc.Timestamp instanceof Date) {
        console.log('Timestamp is Date object:', doc.Timestamp.toISOString());
      }
    } else {
      console.log('⚠️ No documents found');
    }

    // Test 6: Try to find with filter
    console.log('\n📊 Test 6: Testing find with filter...');
    const docs = await CraneLog.find({}).limit(3).lean();
    console.log('✅ Find query successful, found:', docs.length, 'documents');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Error type:', error.constructor.name);
    if (error.name === 'MongooseError') {
      console.error('Mongoose error code:', error.code);
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testConnection();
