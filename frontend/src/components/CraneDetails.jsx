import React from 'react';
import { Card, Badge, Row, Col } from 'react-bootstrap';
import { PiMapPin, PiTimer, PiRuler, PiCraneDuotone } from 'react-icons/pi';
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
    return `${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}`;
  };
  
  // ✅ Helper function to format timestamp
  const formatTimestamp = (timestamp) => {
    const [date, time] = timestamp.split(' ');
    return `${date} at ${time}`;
  };
  

  
  // ✅ Helper function to get movement status
  const getMovementStatus = (distance) => {
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
              </div>
            </Col>
          </Row>
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