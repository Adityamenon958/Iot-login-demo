import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import styles from './LiveCraneLocations.module.css';

// ✅ Fix Leaflet marker icons (required for React-Leaflet)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ✅ Custom crane marker icons with proper event handling
const createCraneIcon = (status) => {
  const colors = {
    working: '#28a745',    // Green
    idle: '#007bff',       // Blue
    maintenance: '#fd7e14', // Orange
    offline: '#6c757d'     // Gray
  };
  
  // Use custom divIcon for better visual appearance
  return L.divIcon({
    className: styles.craneMarker,
    html: `<div style="
      width: 20px; 
      height: 20px; 
      background-color: ${colors[status] || colors.offline}; 
      border: 2px solid white; 
      border-radius: 50%; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
};

// ✅ Map center component for auto-centering
function MapCenter({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

const LiveCraneLocations = ({ cranes = [] }) => {
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]); // Default: India center
  const [selectedCrane, setSelectedCrane] = useState(null);
  const [liveCranes, setLiveCranes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // ✅ Format hours to HH:MM format
  const formatHoursToHoursMinutes = (hours) => {
    if (hours === 0) return "0h 0m";
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  };

  // ✅ Format timestamp to readable format
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Never";
    try {
      const [datePart, timePart] = timestamp.split(' ');
      const [day, month, year] = datePart.split('/');
      const [hour, minute] = timePart.split(':');
      const date = new Date(year, month - 1, day, hour, minute);
      const now = new Date();
      const diffMs = now - date;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      // ✅ Show relative time if within 24 hours, otherwise show actual date/time
      if (diffHours < 24) {
        if (diffHours > 0) {
          return `${diffHours}h ${diffMinutes}m ago`;
        } else {
          return `${diffMinutes}m ago`;
        }
      } else {
        // ✅ More than 24 hours ago - show actual date and time
        const formattedDate = `${day}/${month}/${year.toString().slice(-2)}`; // dd/mm/yy
        const formattedTime = `${hour}:${minute}`; // hh:mm
        return `${formattedDate} ${formattedTime}`;
      }
    } catch (err) {
      return "Invalid date";
    }
  };
  
  // ✅ Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  
  // ✅ Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenModal, setShowFullscreenModal] = useState(false);
  
  // ✅ Tooltip states
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const [craneStats, setCraneStats] = useState({});

  // ✅ Fetch live crane data
  useEffect(() => {
    let isMounted = true;
    
    const fetchLiveCranes = async () => {
      try {
        if (!isMounted) return;
        
        setLoading(true);
        setError(null);
        
        const response = await axios.get('/api/crane/live-locations', {
          withCredentials: true
        });
        
        if (!isMounted) return;
        
        const cranesData = response.data;
        console.log('🗺️ Live crane data received:', cranesData);
        
        setLiveCranes(cranesData);
        
        // ✅ Update map center based on crane positions
        if (cranesData.length > 0) {
          const validCranes = cranesData.filter(crane => crane.latitude && crane.longitude);
          if (validCranes.length > 0) {
            const avgLat = validCranes.reduce((sum, crane) => sum + crane.latitude, 0) / validCranes.length;
            const avgLng = validCranes.reduce((sum, crane) => sum + crane.longitude, 0) / validCranes.length;
            setMapCenter([avgLat, avgLng]);
          }
        }
        
      } catch (err) {
        if (!isMounted) return;
        
        console.error('❌ Error fetching live crane data:', err);
        setError('Failed to load crane locations');
        
        // ✅ Fallback to props data if available
        if (cranes.length > 0) {
          const validCranes = cranes.filter(crane => crane.latitude && crane.longitude);
          if (validCranes.length > 0) {
            const avgLat = validCranes.reduce((sum, crane) => sum + crane.latitude, 0) / validCranes.length;
            const avgLng = validCranes.reduce((sum, crane) => sum + crane.longitude, 0) / validCranes.length;
            setMapCenter([avgLat, avgLng]);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchLiveCranes();
    
    // ✅ Set up auto-refresh every 30 seconds (only if component is mounted)
    const interval = setInterval(() => {
      if (isMounted) {
        fetchLiveCranes();
      }
    }, 30000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []); // Remove cranes dependency to prevent infinite loops

  // ✅ SEPARATE useEffect for pre-loading crane stats (runs only once)
  useEffect(() => {
    let isMounted = true;
    
    const preloadCraneStats = async () => {
      if (liveCranes.length === 0) return;
      
      console.log('📊 Pre-loading stats for all cranes...');
      
      for (const crane of liveCranes) {
        if (!isMounted) return;
        
        const deviceId = crane.id || crane.craneId;
        if (deviceId && !craneStats[deviceId]) {
          try {
            console.log('📊 Pre-loading stats for crane:', deviceId);
            const statsResponse = await axios.get(`/api/crane/daily-stats/${deviceId}`, {
              withCredentials: true
            });
            console.log('📊 Pre-loaded stats for crane', deviceId, ':', statsResponse.data);
            
            if (isMounted) {
              setCraneStats(prev => ({
                ...prev,
                [deviceId]: statsResponse.data
              }));
            }
          } catch (err) {
            console.error('❌ Error pre-loading stats for crane', deviceId, ':', err);
          }
        }
      }
    };

    preloadCraneStats();
    
    return () => {
      isMounted = false;
    };
  }, [liveCranes]); // Only run when liveCranes changes

  // ✅ Add global mouse leave handler to close tooltip
  useEffect(() => {
    const handleDocumentMouseLeave = () => {
      setShowTooltip(false);
      setTooltipData(null);
    };

    document.addEventListener('mouseleave', handleDocumentMouseLeave);
    
    return () => {
      document.removeEventListener('mouseleave', handleDocumentMouseLeave);
    };
  }, []);


  // ✅ Handle crane marker click
  const handleCraneClick = (crane) => {
    setSelectedCrane(crane);
  };

  // ✅ Filter cranes based on current filters
  const filteredCranes = liveCranes.filter(crane => {
    // Status filter
    if (statusFilter !== 'all' && crane.status !== statusFilter) {
      return false;
    }
    
    // Search filter
    if (searchFilter && !crane.id?.toLowerCase().includes(searchFilter.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  // ✅ Toggle fullscreen mode
  const toggleFullscreen = () => {
    setShowFullscreenModal(!showFullscreenModal);
    setIsFullscreen(!showFullscreenModal);
  };

  // ✅ Fetch daily stats for a crane
  const fetchCraneStats = async (deviceId) => {
    try {
      console.log('📊 Fetching daily stats for crane:', deviceId);
      const response = await axios.get(`/api/crane/daily-stats/${deviceId}`, {
        withCredentials: true
      });
      console.log('📊 Daily stats response for crane', deviceId, ':', response.data);
      setCraneStats(prev => ({
        ...prev,
        [deviceId]: response.data
      }));
    } catch (err) {
      console.error('❌ Error fetching crane stats:', err);
    }
  };

  // ✅ Handle crane marker hover
  const handleCraneHover = (crane, event) => {
    const deviceId = crane.id || crane.craneId;
    console.log('🖱️ Hover on crane:', deviceId);
    console.log('📊 Available stats:', craneStats[deviceId]);
    
    // ✅ Calculate tooltip position using mouse coordinates
    const x = event.originalEvent.clientX;
    const y = event.originalEvent.clientY - 10;
    
    setTooltipData(crane);
    setTooltipPosition({ x, y });
    setShowTooltip(true);
  };

  // ✅ Handle crane marker leave
  const handleCraneLeave = () => {
    console.log('🖱️ Crane hover ended');
    setShowTooltip(false);
    setTooltipData(null);
  };





  // ✅ Show loading state
  if (loading) {
    return (
      <div className={styles.mapContainer}>
        <div className={styles.mapHeader}>
          <h6 className="mb-0">Live Crane Locations</h6>
          <div className={styles.mapStats}>
            <span className={styles.statItem}>Loading...</span>
          </div>
        </div>
        <div className={styles.mapWrapper}>
          <div className={styles.mapLoading}>
            <div className="spinner-border spinner-border-sm me-2" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            Loading crane locations...
          </div>
        </div>
      </div>
    );
  }

  // ✅ Show error state
  if (error) {
    return (
      <div className={styles.mapContainer}>
        <div className={styles.mapHeader}>
          <h6 className="mb-0">Live Crane Locations</h6>
          <div className={styles.mapStats}>
            <span className={styles.statItem}>Error</span>
          </div>
        </div>
        <div className={styles.mapWrapper}>
          <div className={styles.mapError}>
            <div className="text-danger mb-2">⚠️</div>
            {error}
            <button 
              className="btn btn-sm btn-outline-primary mt-2"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={styles.mapContainer}>
        <div className={styles.mapHeader}>
          <h6 className="mb-0">Live Crane Locations</h6>
          
          {/* ✅ Filters Section */}
          <div className={styles.filtersSection}>
            {/* Status Filter */}
            <select 
              className={styles.statusFilter}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="working">Working</option>
              <option value="idle">Idle</option>
              <option value="maintenance">Maintenance</option>
            </select>
            
            {/* Search Filter */}
            <input
              type="text"
              className={styles.searchFilter}
              placeholder="Search crane ID..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
          
          <div className={styles.mapStats}>
            <span className={styles.statItem}>
              <span className={styles.statDot} style={{ backgroundColor: '#28a745' }}></span>
              Working: {filteredCranes.filter(c => c.status === 'working').length}
            </span>
            <span className={styles.statItem}>
              <span className={styles.statDot} style={{ backgroundColor: '#007bff' }}></span>
              Idle: {filteredCranes.filter(c => c.status === 'idle').length}
            </span>
            <span className={styles.statItem}>
              <span className={styles.statDot} style={{ backgroundColor: '#fd7e14' }}></span>
              Maintenance: {filteredCranes.filter(c => c.status === 'maintenance').length}
            </span>
            
            {/* ✅ Fullscreen Button */}
            <button 
              className={styles.fullscreenButton}
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              <i className={`bi ${isFullscreen ? 'bi-fullscreen-exit' : 'bi-fullscreen'}`}></i>
            </button>
            
            {/* ✅ Refresh Button */}
            <button 
              className={styles.refreshButton}
              onClick={() => {
                setLoading(true);
                // Trigger a refresh by calling the fetch function
                const fetchLiveCranes = async () => {
                  try {
                    const response = await axios.get('/api/crane/live-locations', {
                      withCredentials: true
                    });
                    setLiveCranes(response.data);
                    setError(null);
                  } catch (err) {
                    setError('Failed to refresh crane locations');
                  } finally {
                    setLoading(false);
                  }
                };
                fetchLiveCranes();
              }}
              title="Refresh crane locations"
            >
              <i className="bi bi-arrow-repeat"></i>
            </button>
          </div>
        </div>
        
        <div className={styles.mapWrapper} onMouseLeave={handleCraneLeave}>
          <MapContainer 
            center={mapCenter} 
            zoom={13} 
            className={styles.map}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <MapCenter center={mapCenter} />
            <ZoomControl position="topright" />
            
            {/* ✅ Base map layer */}
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
                         {/* ✅ Crane markers */}
             {filteredCranes.length === 0 ? (
              <div className={styles.noCranesMessage}>
                <div className="text-center text-muted p-4">
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚧</div>
                  <p className="mb-0">No crane data available</p>
                  <small className="text-muted">Check if cranes are connected and sending data</small>
                </div>
              </div>
            ) : (
                             filteredCranes.map((crane, index) => {
                 if (crane.latitude && crane.longitude) {
                   return (
                                         <Marker
                       key={crane.id || crane.craneId}
                       position={[crane.latitude, crane.longitude]}
                       icon={createCraneIcon(crane.status)}
                                               eventHandlers={{
                          click: () => handleCraneClick(crane),
                          mouseover: (e) => {
                            console.log('🖱️ MARKER HOVER EVENT TRIGGERED for crane:', crane.id);
                            handleCraneHover(crane, e);
                          },
                          mouseout: () => {
                            console.log('🖱️ MARKER HOVER OUT EVENT TRIGGERED for crane:', crane.id);
                            handleCraneLeave();
                          }
                        }}
                     >
                      <Popup>
                        <div className={styles.cranePopup}>
                          <h6>{crane.id || crane.craneId}</h6>
                          <p><strong>Status:</strong> {crane.status || 'Unknown'}</p>
                          <p><strong>Location:</strong> {crane.location || 'N/A'}</p>
                          <p><strong>Company:</strong> {crane.company || crane.craneCompany || 'N/A'}</p>
                          {(crane.lastUpdated || crane.Timestamp) && (
                            <p><strong>Last Updated:</strong> {formatTimestamp(crane.lastUpdated || crane.Timestamp)}</p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                } else {
                  console.log(`🗺️ Skipping crane ${index} - missing coordinates:`, crane);
                }
                return null;
              })
            )}
          </MapContainer>
        </div>
        
                 {/* ✅ Selected crane details panel */}
         {selectedCrane && (
           <div className={styles.craneDetails}>
             <div className={styles.craneDetailsHeader}>
               <h6 className="mb-0">Crane Details</h6>
               <button 
                 className={styles.closeButton}
                 onClick={() => setSelectedCrane(null)}
               >
                 ×
               </button>
             </div>
             <div className={styles.craneDetailsContent}>
               <p><strong>ID:</strong> {selectedCrane.id || selectedCrane.craneId}</p>
               <p><strong>Status:</strong> {selectedCrane.status || 'Unknown'}</p>
                               <p><strong>Company:</strong> {selectedCrane.company || selectedCrane.craneCompany || 'N/A'}</p>
                <p><strong>Location:</strong> {selectedCrane.location || 'N/A'}</p>
                <p><strong>Coordinates:</strong> {selectedCrane.latitude}, {selectedCrane.longitude}</p>
                <p><strong>Digital Input 1:</strong> {selectedCrane.digitalInput1 || selectedCrane.DigitalInput1 || 'N/A'}</p>
                <p><strong>Digital Input 2:</strong> {selectedCrane.digitalInput2 || selectedCrane.DigitalInput2 || 'N/A'}</p>
                <p><strong>Last Seen:</strong> {formatTimestamp(selectedCrane.lastUpdated || selectedCrane.Timestamp)}</p>
               
               {/* ✅ Daily Statistics */}
               {craneStats[selectedCrane.id || selectedCrane.craneId] ? (
                 <div className={styles.dailyStats}>
                   <h6 className="mt-3 mb-2">Today's Activity</h6>
                   <div className={styles.statsGrid}>
                     <div className={styles.statItem}>
                       <span className={styles.statDot} style={{ backgroundColor: '#28a745' }}></span>
                       <span>Working: {formatHoursToHoursMinutes(craneStats[selectedCrane.id || selectedCrane.craneId].workingHours)}</span>
                     </div>
                     <div className={styles.statItem}>
                       <span className={styles.statDot} style={{ backgroundColor: '#007bff' }}></span>
                       <span>Idle: {formatHoursToHoursMinutes(craneStats[selectedCrane.id || selectedCrane.craneId].idleHours)}</span>
                     </div>
                     <div className={styles.statItem}>
                       <span className={styles.statDot} style={{ backgroundColor: '#fd7e14' }}></span>
                       <span>Maintenance: {formatHoursToHoursMinutes(craneStats[selectedCrane.id || selectedCrane.craneId].maintenanceHours)}</span>
                     </div>
                     <div className={styles.statItem}>
                       <span className={styles.statDot} style={{ backgroundColor: '#6c757d' }}></span>
                       <span>Total: {formatHoursToHoursMinutes(craneStats[selectedCrane.id || selectedCrane.craneId].totalHours)}</span>
                     </div>
                   </div>
                 </div>
               ) : (
                 <div className={styles.dailyStats}>
                   <h6 className="mt-3 mb-2">Today's Activity</h6>
                   <div className={styles.statsGrid}>
                     <div className={styles.statItem}>
                       <span className={styles.statDot} style={{ backgroundColor: '#28a745' }}></span>
                       <span>Working: 0h 0m</span>
                     </div>
                     <div className={styles.statItem}>
                       <span className={styles.statDot} style={{ backgroundColor: '#007bff' }}></span>
                       <span>Idle: 0h 0m</span>
                     </div>
                     <div className={styles.statItem}>
                       <span className={styles.statDot} style={{ backgroundColor: '#fd7e14' }}></span>
                       <span>Maintenance: 0h 0m</span>
                     </div>
                     <div className={styles.statItem}>
                       <span className={styles.statDot} style={{ backgroundColor: '#6c757d' }}></span>
                       <span>Total: 0h 0m</span>
                     </div>
                   </div>
                 </div>
               )}
             </div>
           </div>
         )}
       </div>

               {/* ✅ Hover Tooltip */}
        {showTooltip && tooltipData && (
          <div 
            className={styles.hoverTooltip}
            style={{
              left: tooltipPosition.x,
              top: tooltipPosition.y,
              transform: 'translateX(-50%)',
              pointerEvents: 'none'
            }}
          >
           <div className={styles.tooltipHeader}>
             <h6 className="mb-1">{tooltipData.id || tooltipData.craneId}</h6>
             <span className={`${styles.statusBadge} ${styles[`status${tooltipData.status}`]}`}>
               {tooltipData.status}
             </span>
           </div>
           
                       <div className={styles.tooltipContent}>
              <p><strong>Company:</strong> {tooltipData.company || tooltipData.craneCompany || 'N/A'}</p>
              <p><strong>Last Seen:</strong> {formatTimestamp(tooltipData.lastUpdated || tooltipData.Timestamp)}</p>
             
                           {/* ✅ Daily Statistics in Tooltip */}
                             {(() => {
                 const deviceId = tooltipData.id || tooltipData.craneId;
                 const stats = craneStats[deviceId];
                 
                 if (stats) {
                   return (
                     <div className={styles.tooltipStats}>
                       <h6 className="mb-2">Today's Activity</h6>
                       <div className={styles.tooltipStatsGrid}>
                         <div className={styles.tooltipStatItem}>
                           <span className={styles.statDot} style={{ backgroundColor: '#28a745' }}></span>
                           <span>Working: {formatHoursToHoursMinutes(stats.workingHours)}</span>
                         </div>
                         <div className={styles.tooltipStatItem}>
                           <span className={styles.statDot} style={{ backgroundColor: '#007bff' }}></span>
                           <span>Idle: {formatHoursToHoursMinutes(stats.idleHours)}</span>
                         </div>
                         <div className={styles.tooltipStatItem}>
                           <span className={styles.statDot} style={{ backgroundColor: '#fd7e14' }}></span>
                           <span>Maintenance: {formatHoursToHoursMinutes(stats.maintenanceHours)}</span>
                         </div>
                       </div>
                     </div>
                   );
                 } else {
                   return (
                     <div className={styles.tooltipStats}>
                       <h6 className="mb-2">Today's Activity</h6>
                       <div className={styles.tooltipStatsGrid}>
                         <div className={styles.tooltipStatItem}>
                           <span className={styles.statDot} style={{ backgroundColor: '#28a745' }}></span>
                           <span>Working: 0h 0m</span>
                         </div>
                         <div className={styles.tooltipStatItem}>
                           <span className={styles.statDot} style={{ backgroundColor: '#007bff' }}></span>
                           <span>Idle: 0h 0m</span>
                         </div>
                         <div className={styles.tooltipStatItem}>
                           <span className={styles.statDot} style={{ backgroundColor: '#fd7e14' }}></span>
                           <span>Maintenance: 0h 0m</span>
                         </div>
                       </div>
                     </div>
                   );
                 }
               })()}
           </div>
         </div>
       )}

      {/* ✅ Fullscreen Modal */}
      {showFullscreenModal && (
        <div className={styles.fullscreenModal}>
          <div className={styles.fullscreenModalContent}>
            {/* Modal Header */}
            <div className={styles.fullscreenModalHeader}>
              <h5 className="mb-0">Live Crane Locations - Fullscreen View</h5>
              <button 
                className={styles.fullscreenCloseButton}
                onClick={() => {
                  setShowFullscreenModal(false);
                  setIsFullscreen(false);
                }}
                title="Close fullscreen"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            
            {/* Modal Body - Large Map */}
                         <div className={styles.fullscreenMapContainer} onMouseLeave={handleCraneLeave}>
               <MapContainer 
                 center={mapCenter} 
                 zoom={13} 
                 className={styles.fullscreenMap}
                 style={{ height: '100%', width: '100%' }}
                 zoomControl={false}
               >
                <MapCenter center={mapCenter} />
                <ZoomControl position="topright" />
                
                {/* Base map layer */}
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                
                {/* Crane markers */}
                {filteredCranes.map((crane, index) => {
                  if (crane.latitude && crane.longitude) {
                    return (
                                             <Marker
                         key={crane.id || crane.craneId}
                         position={[crane.latitude, crane.longitude]}
                         icon={createCraneIcon(crane.status)}
                                                   eventHandlers={{
                            click: () => setSelectedCrane(crane),
                            mouseover: (e) => {
                              console.log('🖱️ FULLSCREEN MARKER HOVER EVENT TRIGGERED for crane:', crane.id);
                              handleCraneHover(crane, e);
                            },
                            mouseout: () => {
                              console.log('🖱️ FULLSCREEN MARKER HOVER OUT EVENT TRIGGERED for crane:', crane.id);
                              handleCraneLeave();
                            }
                          }}
                       >
                        <Popup>
                          <div className={styles.cranePopup}>
                            <h6>{crane.id || crane.craneId}</h6>
                            <p><strong>Status:</strong> {crane.status || 'Unknown'}</p>
                            <p><strong>Location:</strong> {crane.location || 'N/A'}</p>
                            <p><strong>Company:</strong> {crane.company || crane.craneCompany || 'N/A'}</p>
                            {(crane.lastUpdated || crane.Timestamp) && (
                              <p><strong>Last Updated:</strong> {formatTimestamp(crane.lastUpdated || crane.Timestamp)}</p>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    );
                  }
                  return null;
                })}
              </MapContainer>
            </div>
            
            {/* Modal Footer - Quick Stats */}
            <div className={styles.fullscreenModalFooter}>
              <div className={styles.fullscreenStats}>
                <span className={styles.statItem}>
                  <span className={styles.statDot} style={{ backgroundColor: '#28a745' }}></span>
                  Working: {filteredCranes.filter(c => c.status === 'working').length}
                </span>
                <span className={styles.statItem}>
                  <span className={styles.statDot} style={{ backgroundColor: '#007bff' }}></span>
                  Idle: {filteredCranes.filter(c => c.status === 'idle').length}
                </span>
                <span className={styles.statItem}>
                  <span className={styles.statDot} style={{ backgroundColor: '#fd7e14' }}></span>
                  Maintenance: {filteredCranes.filter(c => c.status === 'maintenance').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LiveCraneLocations;
