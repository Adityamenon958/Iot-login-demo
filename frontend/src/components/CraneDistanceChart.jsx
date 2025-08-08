import React, { useState, useEffect } from 'react';
import { Card, Form, Spinner, Alert, Button, Tooltip, OverlayTrigger } from 'react-bootstrap';
import { PiMapPin } from 'react-icons/pi';
import { getGoogleMapsUrl, openGoogleMaps, isValidCoordinates } from '../utils/mapUtils';
import axios from 'axios';
import styles from './CraneDistanceChart.module.css';

export default function CraneDistanceChart({ onCraneSelect }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [movementData, setMovementData] = useState(null);
  
  // ✅ Helper function to get current date in DD/MM/YYYY format
  function getCurrentDate() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  // ✅ Convert DD/MM/YYYY to YYYY-MM-DD for input
  function convertDateFormat(dateStr) {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  }
  
  // ✅ Convert YYYY-MM-DD to DD/MM/YYYY
  function convertToInputFormat(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  
  const [selectedDate, setSelectedDate] = useState(getCurrentDate()); // Initialized with current date
  
  // ✅ Fetch movement data
  useEffect(() => {
    fetchMovementData();
  }, [selectedDate]);
  
  const fetchMovementData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`/api/crane/movement?date=${selectedDate}`, {
        withCredentials: true
      });
      
      setMovementData(response.data);
    } catch (err) {
      console.error('❌ Failed to fetch movement data:', err);
      setError('Failed to load movement data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDateChange = (e) => {
    const newDate = convertToInputFormat(e.target.value);
    setSelectedDate(newDate);
  };
  
  const handleCraneClick = (craneData) => {
    onCraneSelect(craneData);
  };
  
  // ✅ Sort cranes by distance (highest first) - now includes all cranes
  const sortedCranes = movementData?.craneDistances ? 
    Object.values(movementData.craneDistances).sort((a, b) => b.distance - a.distance) : [];
  
  return (
    <Card className={styles.distanceChartCard}>
      <Card.Header className="py-2 bg-white border-bottom">
        <div className="d-flex justify-content-between align-items-center">
          <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
            Daily Crane Movements
          </h6>
          <Form.Control
            type="date"
            value={convertDateFormat(selectedDate)}
            onChange={handleDateChange}
            size="sm"
            style={{ width: 'auto', fontSize: '0.7rem' }}
          />
        </div>
      </Card.Header>
      <Card.Body className="p-3">
        {loading && (
          <div className="text-center py-3">
            <Spinner animation="border" size="sm" />
            <p className="mt-2 mb-0" style={{ fontSize: '0.7rem' }}>Loading movement data...</p>
          </div>
        )}
        
        {error && (
          <Alert variant="danger" className="py-2" style={{ fontSize: '0.7rem' }}>
            {error}
          </Alert>
        )}
        
        {!loading && !error && movementData && (
          <>
            {/* Chart Title */}
            <div className="mb-3">
              <h6 className={`mb-1 ${styles.chartTitle}`} style={{ fontSize: '0.8rem' }}>
                Distance Traveled on {selectedDate}
              </h6>
              <p className={`mb-0 ${styles.chartSubtitle}`}>
                Total: {movementData.totalDistance}m | Average: {movementData.averageDistance}m
              </p>
            </div>
            
            {/* Crane Bars */}
            <div className={styles.chartContainer}>
              {sortedCranes.length > 0 ? (
                sortedCranes.map((crane, index) => (
                  <div 
                    key={crane.deviceId}
                    className={styles.craneBar}
                  >
                    <div className={styles.craneLabel}>
                      <span className={styles.craneName}>{crane.deviceId}</span>
                      <span className={styles.craneDistance}>{crane.distance}m</span>
                    </div>
                    <div className={styles.barContainer}>
                      <div 
                        className={styles.bar}
                        style={{ 
                          width: `${crane.distance > 0 ? Math.min((crane.distance / Math.max(...sortedCranes.map(c => c.distance))) * 100, 100) : 0}%` 
                        }}
                        onClick={() => handleCraneClick(crane)}
                      />
                    </div>
                    {/* ✅ Quick Location Button */}
                    <OverlayTrigger
                      placement="top"
                      overlay={
                        <Tooltip>
                          {crane.endLocation.lat === 0 && crane.endLocation.lon === 0
                            ? 'No location data available'
                            : 'View crane location on Google Maps'}
                        </Tooltip>
                      }
                    >
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        className={`${styles.locationButton}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = getGoogleMapsUrl(crane.endLocation.lat, crane.endLocation.lon);
                          openGoogleMaps(url);
                        }}
                        disabled={!isValidCoordinates(crane.endLocation.lat, crane.endLocation.lon)}
                      >
                        <PiMapPin size={12} />
                      </Button>
                    </OverlayTrigger>
                  </div>
                ))
              ) : (
                <div className="text-center py-3">
                  <p className="mb-0 text-muted" style={{ fontSize: '0.7rem' }}>
                    No cranes available for {selectedDate}
                  </p>
                </div>
              )}
            </div>
            
            {/* Summary */}
            {sortedCranes.length > 0 && (
              <div className="mt-3 pt-2 border-top">
                <div className="row text-center">
                  <div className="col-4">
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryValue}>{sortedCranes.length}</div>
                      <div className={styles.summaryLabel}>Cranes</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryValue}>{movementData.totalDistance}m</div>
                      <div className={styles.summaryLabel}>Total</div>
                    </div>
                  </div>
                  <div className="col-4">
                    <div className={styles.summaryItem}>
                      <div className={styles.summaryValue}>{movementData.averageDistance}m</div>
                      <div className={styles.summaryLabel}>Avg</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
} 