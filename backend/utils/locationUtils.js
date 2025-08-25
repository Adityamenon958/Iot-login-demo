// backend/utils/locationUtils.js

// ✅ Haversine formula for accurate GPS distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c * 1000; // Convert to meters
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

// ✅ Validate GPS coordinates
function validateGPSData(lat, lon) {
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  return !isNaN(latNum) && !isNaN(lonNum) && 
         latNum >= -90 && latNum <= 90 && 
         lonNum >= -180 && lonNum <= 180;
}

// ✅ Calculate daily distance for a specific crane
function calculateDailyDistance(craneLogs, targetDate) {
  if (!craneLogs || craneLogs.length < 2) return 0;
  
  let totalDistance = 0;
  let previousLat = null;
  let previousLon = null;
  
  // ✅ Filter out logs with invalid GPS data first
  const validGPSLogs = craneLogs.filter(log => {
    return validateGPSData(log.Latitude, log.Longitude) && 
           parseFloat(log.Latitude) !== 0 && 
           parseFloat(log.Longitude) !== 0;
  });
  
  if (validGPSLogs.length < 2) {
    console.log(`⚠️ Not enough valid GPS data for distance calculation. Valid logs: ${validGPSLogs.length}`);
    return 0;
  }
  
  // Sort logs by timestamp
  validGPSLogs.sort((a, b) => {
    // ✅ Handle both Date objects and string timestamps
    if (a.Timestamp instanceof Date && b.Timestamp instanceof Date) {
      return a.Timestamp.getTime() - b.Timestamp.getTime();
    }
    
    // ✅ Fallback to string parsing if needed
    const aParts = a.Timestamp.split(' ');
    const bParts = b.Timestamp.split(' ');
    
    if (aParts.length < 2 || bParts.length < 2) return 0;
    
    const aTime = new Date(aParts[1]);
    const bTime = new Date(bParts[1]);
    return aTime - bTime;
  });
  
  for (let i = 0; i < validGPSLogs.length; i++) {
    const log = validGPSLogs[i];
    
    const currentLat = parseFloat(log.Latitude);
    const currentLon = parseFloat(log.Longitude);
    
    if (previousLat !== null && previousLon !== null) {
      const distance = calculateDistance(previousLat, previousLon, currentLat, currentLon);
      totalDistance += distance;
      console.log(`📍 Distance from ${previousLat},${previousLon} to ${currentLat},${currentLon} = ${distance}m`);
    }
    
    previousLat = currentLat;
    previousLon = currentLon;
  }
  
  return totalDistance;
}

// ✅ Calculate distances for all cranes on a specific date
function calculateAllCraneDistances(allCraneLogs, targetDate) {
  const craneDistances = {};
  let totalDistance = 0;
  let craneCount = 0;
  
  // Group logs by DeviceID
  const craneGroups = {};
  allCraneLogs.forEach(log => {
    if (!craneGroups[log.DeviceID]) {
      craneGroups[log.DeviceID] = [];
    }
    craneGroups[log.DeviceID].push(log);
  });
  
  // Calculate distance for each crane
  Object.keys(craneGroups).forEach(deviceId => {
    const craneLogs = craneGroups[deviceId];
    const distance = calculateDailyDistance(craneLogs, targetDate);
    
    // ✅ Filter valid GPS logs for location data - ONLY when crane is working (ignition on)
    const workingGPSLogs = craneLogs.filter(log => {
      return validateGPSData(log.Latitude, log.Longitude) && 
             parseFloat(log.Latitude) !== 0 && 
             parseFloat(log.Longitude) !== 0 &&
             log.DigitalInput1 === "1"; // ✅ Only include logs when crane ignition is ON
    });
    
    // ✅ Fallback to all valid GPS logs if no working logs found
    const validGPSLogs = workingGPSLogs.length > 0 ? workingGPSLogs : craneLogs.filter(log => {
      return validateGPSData(log.Latitude, log.Longitude) && 
             parseFloat(log.Latitude) !== 0 && 
             parseFloat(log.Longitude) !== 0;
    });
    
    if (distance > 0 && validGPSLogs.length > 0) {
      // ✅ Build route from working logs
      let route = validGPSLogs.map(log => ({
        lat: parseFloat(log.Latitude),
        lon: parseFloat(log.Longitude),
        timestamp: log.Timestamp
      }));
      
      // ✅ Default endLocation is the last working log
      let endLocation = {
        lat: validGPSLogs[validGPSLogs.length - 1].Latitude,
        lon: validGPSLogs[validGPSLogs.length - 1].Longitude,
        timestamp: validGPSLogs[validGPSLogs.length - 1].Timestamp
      };
      
      // ✅ Find the ignition OFF log after the last working log and append to route
      try {
        const lastWorkingLog = validGPSLogs[validGPSLogs.length - 1];
        console.log(`🔍 [${deviceId}] Last working log:`, {
          timestamp: lastWorkingLog.Timestamp,
          digitalInput1: lastWorkingLog.DigitalInput1
        });
        
        const lastWorkingIndex = craneLogs.findIndex(log => 
          log.Timestamp === lastWorkingLog.Timestamp && 
          log.DeviceID === lastWorkingLog.DeviceID
        );
        
        console.log(`🔍 [${deviceId}] Found at index:`, lastWorkingIndex, 'of', craneLogs.length);
        
        if (lastWorkingIndex >= 0 && lastWorkingIndex < craneLogs.length - 1) {
          const nextLog = craneLogs[lastWorkingIndex + 1];
          console.log(`🔍 [${deviceId}] Next log:`, {
            timestamp: nextLog.Timestamp,
            digitalInput1: nextLog.DigitalInput1,
            lat: nextLog.Latitude,
            lon: nextLog.Longitude
          });
          
          if (nextLog && nextLog.DigitalInput1 === "0" && 
              validateGPSData(nextLog.Latitude, nextLog.Longitude) &&
              parseFloat(nextLog.Latitude) !== 0 && 
              parseFloat(nextLog.Longitude) !== 0) {
            console.log(`✅ [${deviceId}] Found ignition OFF log, updating end location`);
            endLocation = {
              lat: nextLog.Latitude,
              lon: nextLog.Longitude,
              timestamp: nextLog.Timestamp
            };
            
            // ✅ Append ignition OFF log as final waypoint
            route.push({
              lat: parseFloat(nextLog.Latitude),
              lon: parseFloat(nextLog.Longitude),
              timestamp: nextLog.Timestamp
            });
            console.log(`✅ [${deviceId}] Added ignition OFF log to route as final waypoint: ${nextLog.Timestamp}`);
          } else {
            console.log(`⚠️ [${deviceId}] Next log is not valid ignition OFF:`, {
              isNextLog: !!nextLog,
              digitalInput1: nextLog?.DigitalInput1,
              hasValidGPS: nextLog ? validateGPSData(nextLog.Latitude, nextLog.Longitude) : false,
              lat: nextLog?.Latitude,
              lon: nextLog?.Longitude
            });
          }
        } else {
          console.log(`⚠️ [${deviceId}] No next log available:`, {
            lastWorkingIndex,
            craneLogsLength: craneLogs.length
          });
        }
      } catch (err) {
        console.warn(`⚠️ Error finding ignition OFF log for ${deviceId}:`, err);
        // Use default endLocation (last working log)
      }
      
      craneDistances[deviceId] = {
        deviceId,
        distance: Math.round(distance * 100) / 100,
        startLocation: {
          lat: validGPSLogs[0].Latitude,
          lon: validGPSLogs[0].Longitude,
          timestamp: validGPSLogs[0].Timestamp
        },
        endLocation: endLocation,
        // ✅ NEW: Complete route with all waypoints + ignition OFF log
        route: route,
        waypointsCount: route.length
      };
      
      totalDistance += distance;
      craneCount++;
    } else if (validGPSLogs.length === 1) {
      // ✅ Handle case with only one valid GPS point (no movement, but has location)
      const route = validGPSLogs.map(log => ({
        lat: parseFloat(log.Latitude),
        lon: parseFloat(log.Longitude),
        timestamp: log.Timestamp
      }));
      
      craneDistances[deviceId] = {
        deviceId,
        distance: 0,
        startLocation: {
          lat: validGPSLogs[0].Latitude,
          lon: validGPSLogs[0].Longitude,
          timestamp: validGPSLogs[0].Timestamp
        },
        endLocation: {
          lat: validGPSLogs[0].Latitude,
          lon: validGPSLogs[0].Longitude,
          timestamp: validGPSLogs[0].Timestamp
        },
        // ✅ NEW: Route with single point
        route: route,
        waypointsCount: 1
      };
      
      craneCount++;
    }
  });
  
  const averageDistance = craneCount > 0 ? totalDistance / craneCount : 0;
  
  return {
    craneDistances,
    totalDistance: Math.round(totalDistance * 100) / 100,
    averageDistance: Math.round(averageDistance * 100) / 100
  };
}

// ✅ Get current date in DD/MM/YYYY format
function getCurrentDateString() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

module.exports = { 
  calculateDistance, 
  validateGPSData, 
  calculateDailyDistance, 
  calculateAllCraneDistances, 
  getCurrentDateString 
}; 