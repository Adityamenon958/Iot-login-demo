// ✅ Google Maps utility functions

// ✅ Generate Google Maps URL for single location
export const getGoogleMapsUrl = (lat, lon) => {
  if (!isValidCoordinates(lat, lon)) {
    console.warn('⚠️ Invalid coordinates for Google Maps:', { lat, lon });
    return null;
  }
  return `https://www.google.com/maps?q=${lat},${lon}`;
};

// ✅ Generate Google Maps URL for route between two points
export const getGoogleMapsRouteUrl = (startLat, startLon, endLat, endLon) => {
  if (!isValidCoordinates(startLat, startLon) || !isValidCoordinates(endLat, endLon)) {
    console.warn('⚠️ Invalid coordinates for route:', { startLat, startLon, endLat, endLon });
    return null;
  }
  return `https://www.google.com/maps/dir/${startLat},${startLon}/${endLat},${endLon}`;
};

// ✅ Generate Google Maps URL for multi-waypoint route
export const getGoogleMapsMultiRouteUrl = (route) => {
  if (!route || route.length < 2) {
    console.warn('⚠️ Invalid route data for multi-waypoint route:', route);
    return null;
  }
  
  // Validate all coordinates
  const validRoute = route.filter(point => isValidCoordinates(point.lat, point.lon));
  if (validRoute.length < 2) {
    console.warn('⚠️ Not enough valid coordinates for route:', validRoute);
    return null;
  }
  
  // Start point
  const start = validRoute[0];
  // End point
  const end = validRoute[validRoute.length - 1];
  // Intermediate waypoints (if any)
  const waypoints = validRoute.slice(1, -1);
  
  if (waypoints.length === 0) {
    // Direct route
    return `https://www.google.com/maps/dir/${start.lat},${start.lon}/${end.lat},${end.lon}`;
  } else {
    // ✅ FIXED: Use proper Google Maps API format for multi-waypoint routes
    const waypointsStr = waypoints.map(point => `${point.lat},${point.lon}`).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lon}&destination=${end.lat},${end.lon}&waypoints=${waypointsStr}`;
  }
};

// ✅ Validate coordinates before opening map
export const isValidCoordinates = (lat, lon) => {
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  return !isNaN(latNum) && !isNaN(lonNum) && 
         latNum >= -90 && latNum <= 90 && 
         lonNum >= -180 && lonNum <= 180;
};

// ✅ Open Google Maps in new tab
export const openGoogleMaps = (url) => {
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    console.error('❌ Invalid Google Maps URL');
  }
};

// ✅ Format coordinates for display
export const formatCoordinates = (lat, lon) => {
  if (!isValidCoordinates(lat, lon)) {
    return 'Invalid coordinates';
  }
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  
  if (latNum === 0 && lonNum === 0) {
    return 'No location data';
  }
  
  return `${latNum.toFixed(4)}, ${lonNum.toFixed(4)}`;
}; 