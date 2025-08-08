import React from 'react';
import { Card, Badge, Row, Col, Button, Tooltip, OverlayTrigger } from 'react-bootstrap';
import { PiMapPin, PiTimer, PiRuler, PiCraneDuotone, PiArrowUpRight } from 'react-icons/pi';
import { getGoogleMapsUrl, getGoogleMapsRouteUrl, openGoogleMaps, isValidCoordinates } from '../utils/mapUtils';
import styles from './CraneDetails.module.css';

export default function CraneDetails({ selectedCrane }) {
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
          
          {/* ✅ Route View Button */}
          {selectedCrane.distance > 0 && (
            <div className="mt-3">
              <OverlayTrigger
                placement="top"
                overlay={
                  <Tooltip>
                    {(selectedCrane.startLocation.lat === 0 && selectedCrane.startLocation.lon === 0) ||
                     (selectedCrane.endLocation.lat === 0 && selectedCrane.endLocation.lon === 0)
                      ? 'No location data available for route' 
                      : 'View the route from start to end location'}
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
                    !isValidCoordinates(selectedCrane.endLocation.lat, selectedCrane.endLocation.lon) ||
                    (selectedCrane.startLocation.lat === 0 && selectedCrane.startLocation.lon === 0) ||
                    (selectedCrane.endLocation.lat === 0 && selectedCrane.endLocation.lon === 0)
                  }
                >
                  <PiArrowUpRight size={14} className="me-1" />
                  {(selectedCrane.startLocation.lat === 0 && selectedCrane.startLocation.lon === 0) ||
                   (selectedCrane.endLocation.lat === 0 && selectedCrane.endLocation.lon === 0)
                    ? 'No Route Data' 
                    : 'View Route'}
                </Button>
              </OverlayTrigger>
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
            <Col xs={6}>
              <div className={styles.statItem}>
                <div className={styles.statValue}>{selectedCrane.distance}m</div>
                <div className={styles.statLabel}>Distance</div>
              </div>
            </Col>
            <Col xs={6}>
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