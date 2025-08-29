# 🚀 IoT Dashboard Data Simulator - Setup Guide

## **Overview**
The built-in data simulator allows superadmin users to generate realistic crane data for testing purposes. It creates periodic logs that match your gateway payload format exactly.

## **🚀 Quick Start**

### 1. Environment Control
The simulator is **automatically controlled** by the environment:

**Local Development**:
```bash
NODE_ENV=development
# Simulator will be automatically disabled
```

**Production**:
```bash
NODE_ENV=production
# Simulator will be automatically enabled
```

### 2. Restart Server
```bash
npm start
# or
node server.js
```

### 3. Access Simulator
- Login as superadmin user
- Navigate to **Simulator** in the sidebar
- Add your first simulated crane

### 4. Auto-restart on Server Restart
- Running simulators automatically resume after server restart
- No need to manually restart devices
- Check server logs for `[sim] 🔄 Found X running devices to restart`

## **🌍 Environment Behavior**

### **Local Development** (`NODE_ENV=development`)
✅ **What Happens**:
- Simulator routes are completely disabled
- Simulator UI is hidden from sidebar
- No simulator functionality available
- Clean development environment

❌ **What's Disabled**:
- All `/api/sim/*` endpoints return 404
- Simulator page is not accessible
- No accidental data sending

### **Production** (`NODE_ENV=production`)
✅ **What Happens**:
- Simulator is fully functional
- All features available to superadmin users
- Automatic restart of running simulators
- Complete simulator functionality

🔧 **Server Logs**:
- `[sim] 🚀 Simulator enabled in production mode`
- `[sim] 🔄 Restarting running simulators...`

## **📋 Device Allow-List Requirement**

**⚠️ IMPORTANT:** To see simulated cranes in your dashboard (maps, charts, overview), you must add the DeviceID to the `Device` collection first.

### Example Device Document:
```javascript
{
  companyName: "Gsn Soln",
  deviceId: "CRANE005", 
  deviceType: "crane",
  uid: "GS-CRANE005"
}
```

### Add via MongoDB Compass or Shell:
```javascript
use your_database_name
db.devices.insertOne({
  companyName: "Gsn Soln",
  deviceId: "CRANE005",
  deviceType: "crane",
  uid: "GS-CRANE005"
})
```

## **🔧 Simulator Features**

### **Payload Format (EXACT)**
```json
[
  { "craneCompany": "Gsn Soln", "DeviceID": "CRANE005", "dataType": "Gps",        "Timestamp": "   1756243800", "data": "[19.045980,73.027397]" },
  { "craneCompany": "Gsn Soln", "DeviceID": "CRANE005", "dataType": "maintenance","Timestamp": "   1756243800", "data": "[0]" },
  { "craneCompany": "CRANE005", "DeviceID": "CRANE005", "dataType": "Ignition",   "Timestamp": "   1756243800", "data": "[0]" }
]
```

### **Configuration Options**
- **Frequency**: 1, 2, 5, 10, 15, 30 minutes
- **States**: working, idle, maintenance
- **Profiles**: 
  - **A**: working=[0,1], maintenance=[1,0], idle=[0,0]
  - **B**: working=[1,0], maintenance=[0,1], idle=[0,0]
- **GPS Jitter**: ±0.0002 degrees (simulates movement)
- **Timestamp Padding**: Adds 3 spaces before epoch timestamp

## **🎯 Testing Workflow**

### 1. Add Simulated Crane
- Company: "Gsn Soln"
- DeviceID: "CRANE005"
- Location: 19.045980, 73.027397
- State: "working"
- Frequency: 1 minute
- Profile: "A"
- Enable: Pad Timestamp, GPS Jitter

### 2. Start Simulator
- Click **Start** button
- Data flows every minute to `/api/crane/log`
- Check server logs: `[sim] ✅ Posted data for CRANE005`

### 3. Verify Dashboard Integration
- Live map shows device at location
- Overview cards update with working hours
- Charts display ongoing activity

### 4. Test State Changes
- Change state to "idle" via Update
- Verify payload changes to `[0]/[0]`
- Dashboard reflects new status

## **🔒 Security & Access**

- **Superadmin only**: All simulator endpoints require superadmin role
- **Feature flag**: Controlled by `ENABLE_SIMULATOR` environment variable
- **Production safe**: Defaults to disabled if flag not set
- **Authentication**: Uses existing JWT cookie system

## **💾 Database Persistence**

- **Automatic Storage**: All simulator configurations are stored in MongoDB
- **Running Status**: Device running state persists across server restarts
- **Auto-restart**: Running simulators automatically resume after server restart
- **Data Recovery**: No need to reconfigure devices after deployment or restart

## **📊 API Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sim/add` | Add simulated crane device |
| `POST` | `/api/sim/start` | Start periodic data posting |
| `POST` | `/api/sim/stop` | Stop periodic data posting |
| `POST` | `/api/sim/update` | Update device configuration |
| `GET` | `/api/sim/list` | List all simulated devices |
| `DELETE` | `/api/sim/remove/:id` | Remove simulated device |

## **🐛 Troubleshooting**

### Simulator Not Visible
- Check `ENABLE_SIMULATOR=true` in `.env`
- Verify user has superadmin role
- Restart server after environment changes

### Data Not Appearing in Dashboard
- Ensure DeviceID exists in `Device` collection
- Check server logs for `[sim]` messages
- Verify `/api/crane/log` endpoint is working

### Permission Errors
- Login as superadmin user
- Check browser console for 403 errors
- Verify JWT token is valid

## **📝 Log Examples**

### Successful Data Posting
```
[sim] ✅ Posted data for CRANE005: working at [19.045980, 73.027397]
```

### Simulator Start/Stop
```
[sim] 🚀 Started simulator for CRANE005 (1m interval)
[sim] ⏹️ Stopped simulator for CRANE005
```

### Error Handling
```
[sim] ❌ Failed to post data for CRANE005: 500
[sim] ❌ Simulator tick error for CRANE005: Network error
```

## **🎉 Success Criteria**

✅ Add DeviceID `CRANE005` with working state  
✅ Start simulator, verify data every minute  
✅ Dashboard shows device on map with correct status  
✅ Change state to idle, verify payload changes  
✅ Stop simulator, data flow ceases  

---

**Need help?** Check server logs for `[sim]` prefixed messages and ensure all environment variables are set correctly.
