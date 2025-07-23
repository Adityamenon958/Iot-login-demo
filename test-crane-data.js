// ✅ Test script to add sample crane data
// Run this with: node test-crane-data.js

const axios = require('axios');

// ✅ Sample crane data for testing
const sampleCraneData = [
  {
    companyName: "Gsn Soln",
    DeviceID: "CRANE-001",
    Timestamp: "2024-01-15T08:00:00.000Z",
    Date: "15/01/2024",
    Time: "08:00:00",
    Longitude: "77.2090",
    Latitude: "28.6139",
    DigitalInput1: "1", // Crane is active
    DigitalInput2: "0"  // Not under maintenance
  },
  {
    companyName: "Gsn Soln",
    DeviceID: "CRANE-001",
    Timestamp: "2024-01-15T10:00:00.000Z",
    Date: "15/01/2024",
    Time: "10:00:00",
    Longitude: "77.2090",
    Latitude: "28.6139",
    DigitalInput1: "1", // Still active
    DigitalInput2: "0"
  },
  {
    companyName: "Gsn Soln",
    DeviceID: "CRANE-001",
    Timestamp: "2024-01-15T12:00:00.000Z",
    Date: "15/01/2024",
    Time: "12:00:00",
    Longitude: "77.2090",
    Latitude: "28.6139",
    DigitalInput1: "0", // Crane stopped
    DigitalInput2: "0"
  },
  {
    companyName: "Gsn Soln",
    DeviceID: "CRANE-002",
    Timestamp: "2024-01-15T09:00:00.000Z",
    Date: "15/01/2024",
    Time: "09:00:00",
    Longitude: "77.2091",
    Latitude: "28.6140",
    DigitalInput1: "1", // Active
    DigitalInput2: "0"
  },
  {
    companyName: "Gsn Soln",
    DeviceID: "CRANE-002",
    Timestamp: "2024-01-15T11:00:00.000Z",
    Date: "15/01/2024",
    Time: "11:00:00",
    Longitude: "77.2091",
    Latitude: "28.6140",
    DigitalInput1: "0", // Stopped
    DigitalInput2: "1"  // Under maintenance
  },
  {
    companyName: "Gsn Soln",
    DeviceID: "CRANE-003",
    Timestamp: "2024-01-15T08:30:00.000Z",
    Date: "15/01/2024",
    Time: "08:30:00",
    Longitude: "77.2092",
    Latitude: "28.6141",
    DigitalInput1: "0", // Inactive
    DigitalInput2: "0"
  }
];

// ✅ Function to add test data
async function addTestCraneData() {
  console.log('🚀 Adding test crane data...');
  
  for (const data of sampleCraneData) {
    try {
      const response = await axios.post('http://localhost:8080/api/crane/log', data);
      console.log(`✅ Added crane log for ${data.DeviceID} at ${data.Time}`);
    } catch (error) {
      console.error(`❌ Failed to add crane log for ${data.DeviceID}:`, error.message);
    }
  }
  
  console.log('✅ Test data addition completed!');
}

// ✅ Run the test
addTestCraneData(); 