const mongoose = require('mongoose');

const companyDashboardAccessSchema = new mongoose.Schema({
  companyName: { 
    type: String, 
    required: true, 
    unique: true 
  },
  dashboardAccess: {
    home: { type: Boolean, default: true },
    dashboard: { type: Boolean, default: true },
    craneOverview: { type: Boolean, default: false },
    elevatorOverview: { type: Boolean, default: false },
    craneDashboard: { type: Boolean, default: false },
    reports: { type: Boolean, default: true },
    addUsers: { type: Boolean, default: true },
    addDevices: { type: Boolean, default: true },
    subscription: { type: Boolean, default: true },
    settings: { type: Boolean, default: true }
  },
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  },
  updatedBy: { 
    type: String, 
    default: 'superadmin' 
  }
}, { timestamps: true });

module.exports = mongoose.model('CompanyDashboardAccess', companyDashboardAccessSchema); 