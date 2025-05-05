const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Sample card data
const dashboardStats = {
  activeDevices: 3,
  inactiveDevices: 4,
  alarms: 4,
};

// Sample table data
const deviceList = [
    {
        id: 1,
        name: "Sensor Alpha",
        location: "Mumbai",
        subscription: "Active"
      },
      {
        id: 2,
        name: "Sensor Beta",
        location: "Delhi",
        subscription: "Inactive"
      },
      {
        id: 3,
        name: "Thermal Scanner",
        location: "Bangalore",
        subscription: "Active"
      },
      {
        id: 4,
        name: "Pressure Monitor",
        location: "Chennai",
        subscription: "Inactive"
      },
      {
        id: 5,
        name: "Humidity Tracker",
        location: "Hyderabad",
        subscription: "Active"
      }
];

// Routes
app.get('/api/dashboard', (req, res) => {
  res.json(dashboardStats);
});

app.get('/api/devices', (req, res) => {
  res.json(deviceList);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
