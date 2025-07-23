// ✅ Check crane data in database
const mongoose = require('mongoose');
const CraneLog = require('./backend/models/CraneLog');

async function checkCraneData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get all crane logs for Gsn Soln
    const logs = await CraneLog.find({ craneCompany: 'Gsn Soln' }).sort({ createdAt: -1 });
    
    console.log(`\n📊 Found ${logs.length} crane logs for Gsn Soln:`);
    console.log('='.repeat(80));
    
    logs.forEach((log, index) => {
      console.log(`${index + 1}. ${log.DeviceID} - ${log.Timestamp} - DigitalInput1: ${log.DigitalInput1} - Created: ${log.createdAt}`);
    });
    
    // Group by device
    const deviceGroups = {};
    logs.forEach(log => {
      if (!deviceGroups[log.DeviceID]) {
        deviceGroups[log.DeviceID] = [];
      }
      deviceGroups[log.DeviceID].push(log);
    });
    
    console.log('\n📋 Grouped by device:');
    console.log('='.repeat(80));
    
    Object.keys(deviceGroups).forEach(deviceId => {
      const deviceLogs = deviceGroups[deviceId];
      console.log(`\n🔧 ${deviceId} (${deviceLogs.length} logs):`);
      deviceLogs.forEach(log => {
        console.log(`   ${log.Timestamp} - DigitalInput1: ${log.DigitalInput1}`);
      });
    });
    
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCraneData(); 