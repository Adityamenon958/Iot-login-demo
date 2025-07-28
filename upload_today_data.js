const mongoose = require('mongoose');
const fs = require('fs');

// Connect to MongoDB
mongoose.connect('mongodb+srv://adityamenon958:aditya123@cluster0.mongodb.net/iot-dashboard?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define CraneLog schema
const craneLogSchema = new mongoose.Schema({
  craneCompany: String,
  DeviceID: String,
  Timestamp: String,
  Longitude: String,
  Latitude: String,
  DigitalInput1: String,
  DigitalInput2: String,
  createdAt: { type: Date, default: Date.now }
});

const CraneLog = mongoose.model('CraneLog', craneLogSchema);

async function uploadTodayData() {
  try {
    console.log('🔄 Starting today-only data upload...');
    
    // Read the JSON file
    const data = JSON.parse(fs.readFileSync('crane_today_test_data.json', 'utf8'));
    
    console.log(`📊 Found ${data.length} records to upload`);
    
    // Clear existing data for this company
    await CraneLog.deleteMany({ craneCompany: "Gsn Soln" });
    console.log('🗑️ Cleared existing data for Gsn Soln');
    
    // Upload new data
    const result = await CraneLog.insertMany(data);
    console.log(`✅ Successfully uploaded ${result.length} records`);
    
    // Verify upload
    const count = await CraneLog.countDocuments({ craneCompany: "Gsn Soln" });
    console.log(`🔍 Total records in database for Gsn Soln: ${count}`);
    
    console.log('🎉 Today-only data upload completed successfully!');
    
  } catch (error) {
    console.error('❌ Error uploading today data:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

uploadTodayData(); 