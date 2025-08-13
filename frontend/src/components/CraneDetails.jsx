import React from 'react';
import { Card, Badge, Row, Col, Button, Tooltip, OverlayTrigger } from 'react-bootstrap';
import { PiMapPin, PiTimer, PiRuler, PiCraneDuotone, PiArrowUpRight } from 'react-icons/pi';
import { getGoogleMapsUrl, getGoogleMapsRouteUrl, getGoogleMapsMultiRouteUrl, openGoogleMaps, isValidCoordinates } from '../utils/mapUtils';
import styles from './CraneDetails.module.css';

export default function CraneDetails({ selectedCrane }) {
  console.log('🔍 CraneDetails received selectedCrane:', selectedCrane);
  
  // ✅ Helper function to format distance
  const formatDistance = (distance) => {
    if (distance >= 1000) {
      return `${(distance / 1000).toFixed(2)} km`;
    }
    return `${distance} m`;
  };
  
  // ✅ Helper function to format coordinates
  const formatCoordinates = (lat, lon) => {
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
  
  // ✅ Helper function to format timestamp
  const formatTimestamp = (timestamp) => {
    const [date, time] = timestamp.split(' ');
    return `${date} at ${time}`;
  };
  

  
  // ✅ Helper function to get movement status
  const getMovementStatus = (distance) => {
    if (distance === 0) return { text: 'No Activity', color: 'secondary' };
    if (distance < 100) return { text: 'Low Activity', color: 'success' };
    if (distance < 500) return { text: 'Normal Activity', color: 'primary' };
    if (distance < 1000) return { text: 'High Activity', color: 'warning' };
    return { text: 'Very High Activity', color: 'danger' };
  };
  
  if (!selectedCrane) {
    return (
      <Card className={styles.detailsCard}>
        <Card.Header className="py-2 bg-white border-bottom">
          <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
            Crane Details
          </h6>
        </Card.Header>
        <Card.Body className="p-3">
          <div className={styles.emptyState}>
            <PiCraneDuotone size={48} />
            <p>
              Select a crane from the chart to view details
            </p>
          </div>
        </Card.Body>
      </Card>
    );
  }
  
  const status = getMovementStatus(selectedCrane.distance);
  
  return (
    <Card className={styles.detailsCard}>
      <Card.Header className="py-2 bg-white border-bottom">
        <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
          {selectedCrane.deviceId} Details
        </h6>
      </Card.Header>
      <Card.Body className="p-3">
        {/* Distance Summary */}
        <div className="mb-3">
          <div className={styles.sectionHeader}>
            <PiRuler size={20} />
            <h6>
              Distance Summary
            </h6>
          </div>
          <div className={styles.distanceRow}>
            <span className={styles.distanceLabel}>Total Distance:</span>
            <span className={`${styles.distanceValue} ${styles.highlight}`}>
              {formatDistance(selectedCrane.distance)}
            </span>
          </div>

          <Badge bg={status.color} className={styles.activityBadge}>
            {status.text}
          </Badge>
        </div>
        
        {/* Location Information */}
        <div className="mb-3">
          <div className={styles.sectionHeader}>
            <PiMapPin size={20} />
            <h6>
              Location Details
            </h6>
          </div>
          
          <Row>
            <Col xs={6}>
              <div className={styles.locationCard}>
                <div className={styles.locationLabel}>Start Location</div>
                <div className={styles.locationCoordinates}>
                  {formatCoordinates(selectedCrane.startLocation.lat, selectedCrane.startLocation.lon)}
                </div>
                <div className={styles.locationTimestamp}>
                  {formatTimestamp(selectedCrane.startLocation.timestamp)}
                </div>
                {/* ✅ Google Maps Button for Start Location */}
                <OverlayTrigger
                  placement="top"
                  overlay={
                    <Tooltip>
                      {selectedCrane.startLocation.lat === 0 && selectedCrane.startLocation.lon === 0 
                        ? 'No location data available' 
                        : 'View start location on Google Maps'}
                    </Tooltip>
                  }
                >
                  <Button
                    size="sm"
                    variant="outline-primary"
                    className="mt-2 w-100"
                    onClick={() => {
                      const url = getGoogleMapsUrl(selectedCrane.startLocation.lat, selectedCrane.startLocation.lon);
                      openGoogleMaps(url);
                    }}
                    disabled={!isValidCoordinates(selectedCrane.startLocation.lat, selectedCrane.startLocation.lon)}
                  >
                    <PiMapPin size={14} className="me-1" />
                    {selectedCrane.startLocation.lat === 0 && selectedCrane.startLocation.lon === 0 
                      ? 'No Location Data' 
                      : 'View on Map'}
                  </Button>
                </OverlayTrigger>
              </div>
            </Col>
            <Col xs={6}>
              <div className={styles.locationCard}>
                <div className={styles.locationLabel}>End Location</div>
                <div className={styles.locationCoordinates}>
                  {formatCoordinates(selectedCrane.endLocation.lat, selectedCrane.endLocation.lon)}
                </div>
                <div className={styles.locationTimestamp}>
                  {formatTimestamp(selectedCrane.endLocation.timestamp)}
                </div>
                {/* ✅ Google Maps Button for End Location */}
                <OverlayTrigger
                  placement="top"
                  overlay={
                    <Tooltip>
                      {selectedCrane.endLocation.lat === 0 && selectedCrane.endLocation.lon === 0 
                        ? 'No location data available' 
                        : 'View end location on Google Maps'}
                    </Tooltip>
                  }
                >
                  <Button
                    size="sm"
                    variant="outline-primary"
                    className="mt-2 w-100"
                    onClick={() => {
                      const url = getGoogleMapsUrl(selectedCrane.endLocation.lat, selectedCrane.endLocation.lon);
                      openGoogleMaps(url);
                    }}
                    disabled={!isValidCoordinates(selectedCrane.endLocation.lat, selectedCrane.endLocation.lon)}
                  >
                    <PiMapPin size={14} className="me-1" />
                    {selectedCrane.endLocation.lat === 0 && selectedCrane.endLocation.lon === 0 
                      ? 'No Location Data' 
                      : 'View on Map'}
                  </Button>
                </OverlayTrigger>
              </div>
            </Col>
          </Row>
          
          {/* ✅ Enhanced Route Information */}
          {selectedCrane.distance > 0 && (
            <div className="mt-3">
              <div className={styles.sectionHeader}>
                <PiArrowUpRight size={20} />
                <h6>
                  Route Information
                </h6>
              </div>
              
              {/* Route Summary */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className={styles.distanceLabel}>Waypoints:</span>
                  <span className={styles.distanceValue}>
                    {selectedCrane.waypointsCount || 'N/A'}
                  </span>
                </div>
                
                {selectedCrane.route && selectedCrane.route.length > 2 && (
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className={styles.distanceLabel}>Route Type:</span>
                    <Badge bg="info" className="fs-6">
                      Multi-Point Route
                    </Badge>
                  </div>
                )}
                
                {selectedCrane.route && selectedCrane.route.length === 2 && (
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className={styles.distanceLabel}>Route Type:</span>
                    <Badge bg="secondary" className="fs-6">
                      Direct Route
                    </Badge>
                  </div>
                )}
                
                {/* ✅ NEW: Route Efficiency Analysis */}
                {selectedCrane.route && selectedCrane.route.length > 2 && (
                  <>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className={styles.distanceLabel}>Route Efficiency:</span>
                      <span className={styles.distanceValue}>
                        {(() => {
                          // Calculate straight-line distance vs actual distance
                          const start = selectedCrane.route[0];
                          const end = selectedCrane.route[selectedCrane.route.length - 1];
                          const straightLineDistance = Math.sqrt(
                            Math.pow(end.lat - start.lat, 2) + Math.pow(end.lon - start.lon, 2)
                          ) * 111000; // Convert to meters (roughly)
                          
                          const efficiency = ((straightLineDistance / selectedCrane.distance) * 100).toFixed(1);
                          return `${efficiency}%`;
                        })()}
                      </span>
                    </div>
                    
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className={styles.distanceLabel}>Avg Speed:</span>
                      <span className={styles.distanceValue}>
                        {(() => {
                          if (selectedCrane.route.length < 2) return 'N/A';
                          
                          const startTime = new Date(selectedCrane.route[0].timestamp);
                          const endTime = new Date(selectedCrane.route[selectedCrane.route.length - 1].timestamp);
                          const durationHours = (endTime - startTime) / (1000 * 60 * 60);
                          
                          if (durationHours <= 0) return 'N/A';
                          
                          const avgSpeed = (selectedCrane.distance / durationHours).toFixed(1);
                          return `${avgSpeed} m/h`;
                        })()}
                      </span>
                    </div>
                  </>
                )}
              </div>
              
              {/* Route View Buttons */}
              <div className="d-grid gap-2">
                {/* View Complete Route (if multiple waypoints) */}
                {selectedCrane.route && selectedCrane.route.length > 2 && (
                  <OverlayTrigger
                    placement="top"
                    overlay={
                      <Tooltip>
                        View the complete route with all {selectedCrane.waypointsCount} waypoints
                      </Tooltip>
                    }
                  >
                    <Button
                      size="sm"
                      variant="success"
                      className="w-100"
                      onClick={() => {
                        const url = getGoogleMapsMultiRouteUrl(selectedCrane.route);
                        if (url) {
                          openGoogleMaps(url);
                        } else {
                          console.error('❌ Failed to generate multi-waypoint route URL');
                        }
                      }}
                    >
                      <PiArrowUpRight size={14} className="me-1" />
                      View Complete Route ({selectedCrane.waypointsCount} points)
                    </Button>
                  </OverlayTrigger>
                )}
                
                {/* View Direct Route (always available) */}
                <OverlayTrigger
                  placement="top"
                  overlay={
                    <Tooltip>
                      View direct route from start to end location
                    </Tooltip>
                  }
                >
                  <Button
                    size="sm"
                    variant="outline-success"
                    className="w-100"
                    onClick={() => {
                      const url = getGoogleMapsRouteUrl(
                        selectedCrane.startLocation.lat,
                        selectedCrane.startLocation.lon,
                        selectedCrane.endLocation.lat,
                        selectedCrane.endLocation.lon
                      );
                      openGoogleMaps(url);
                    }}
                    disabled={
                      !isValidCoordinates(selectedCrane.startLocation.lat, selectedCrane.startLocation.lon) ||
                      !isValidCoordinates(selectedCrane.endLocation.lat, selectedCrane.endLocation.lon)
                    }
                  >
                    <PiArrowUpRight size={14} className="me-1" />
                    View Direct Route
                  </Button>
                </OverlayTrigger>
              </div>
            </div>
          )}
        </div>
        
        {/* Statistics */}
        <div>
          <div className={styles.sectionHeader}>
            <PiTimer size={20} />
            <h6>
              Movement Statistics
            </h6>
          </div>
          
          <Row className="text-center">
            <Col xs={4}>
              <div className={styles.statItem}>
                <div className={styles.statValue}>{selectedCrane.distance}m</div>
                <div className={styles.statLabel}>Distance</div>
              </div>
            </Col>
            <Col xs={4}>
              <div className={styles.statItem}>
                <div className={styles.statValue}>{selectedCrane.waypointsCount || 'N/A'}</div>
                <div className={styles.statLabel}>Waypoints</div>
              </div>
            </Col>
            <Col xs={4}>
              <div className={styles.statItem}>
                <div className={styles.statValue}>{status.text.split(' ')[0]}</div>
                <div className={styles.statLabel}>Level</div>
              </div>
            </Col>
          </Row>
        </div>
      </Card.Body>
    </Card>
  );
} 