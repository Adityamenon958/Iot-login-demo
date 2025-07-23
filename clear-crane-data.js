// ✅ Clear old crane test data
const mongoose = require('mongoose');
const CraneLog = require('./backend/models/CraneLog');

async function clearCraneData() {
  try {
    // Connect using the same method as server.js
    const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://adityamenon958:adityamenon958@cluster0.mongodb.net/iot-dashboard?retryWrites=true&w=majority";
    
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Delete all crane logs for Gsn Soln
    const result = await CraneLog.deleteMany({ craneCompany: 'Gsn Soln' });
    
    console.log(`🗑️ Deleted ${result.deletedCount} crane logs for Gsn Soln`);
    console.log('✅ Database cleared! Now send your 5 new JSON entries again.');
    
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

clearCraneData(); 