import React, { useEffect, useState, useMemo } from 'react';
import { Col, Row, Card, Badge, Spinner } from 'react-bootstrap';
import axios from 'axios';
import styles from "./MainContent.module.css";
import { PiElevatorDuotone, PiCheckCircleDuotone, PiXCircleDuotone, PiWarningCircleDuotone } from "react-icons/pi";

// ✅ Format helpers
const formatDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
};

const formatTimeAgo = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  
  // Show detailed time for recent updates
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) { // Less than 24 hours
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    return `${diffHours}h ${remainingMins}m ago`;
  }
  
  // For older updates, show exact date and time
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// ✅ Binary conversion helpers
const decimalToBinary = (decimal, bits = 16) => {
  return parseInt(decimal).toString(2).padStart(bits, '0');
};

const binaryToDecimal = (binary) => {
  return parseInt(binary, 2);
};

const split16BitTo8Bit = (binary16) => {
  const padded = binary16.padStart(16, '0');
  return {
    high: padded.substring(0, 8),
    low: padded.substring(8, 16)
  };
};

// ✅ Status processing helpers
const processElevatorData = (dataArray) => {
  if (!dataArray || dataArray.length < 2) {
    return {
      floor: 0,
      primaryStatus: [],
      serviceStatus: [],
      powerStatus: [],
      overallStatus: 'unknown'
    };
  }

  // Process Register 65 (first number)
  const reg65 = parseInt(dataArray[0]) || 0;
  const reg65Binary = decimalToBinary(reg65, 16);
  const reg65Split = split16BitTo8Bit(reg65Binary);
  
  // 65H - Floor number
  const floor = binaryToDecimal(reg65Split.high);
  
  // 65L - Primary status flags (bit0 = rightmost character)
  const primaryStatus = [];
  const reg65L = reg65Split.low;
  if (reg65L[7] === '1') primaryStatus.push('Door Open');      // bit0
  if (reg65L[6] === '1') primaryStatus.push('Attendant');      // bit1
  if (reg65L[5] === '1') primaryStatus.push('Independent');    // bit2
  if (reg65L[4] === '1') primaryStatus.push('Fire Exclusive'); // bit3
  if (reg65L[3] === '1') primaryStatus.push('Inspection');     // bit4
  if (reg65L[2] === '1') primaryStatus.push('Comprehensive Fault'); // bit5
  if (reg65L[1] === '1') primaryStatus.push('Down');           // bit6
  if (reg65L[0] === '1') primaryStatus.push('Up');             // bit7

  // Process Register 66 (second number)
  const reg66 = parseInt(dataArray[1]) || 0;
  const reg66Binary = decimalToBinary(reg66, 16);
  const reg66Split = split16BitTo8Bit(reg66Binary);
  
  // 66H - Service status flags (bit0 = rightmost character)
  const serviceStatus = [];
  const reg66H = reg66Split.high;
  if (reg66H[7] === '1') serviceStatus.push('In Service');      // bit0
  if (reg66H[6] === '1') serviceStatus.push('Comm Normal');     // bit1
  if (reg66H[5] === '1') serviceStatus.push('Maintenance ON');  // bit2
  if (reg66H[4] === '1') serviceStatus.push('Overload');        // bit3
  if (reg66H[3] === '1') serviceStatus.push('Automatic');       // bit4
  if (reg66H[2] === '1') serviceStatus.push('Car Walking');     // bit5
  if (reg66H[1] === '1') serviceStatus.push('Earthquake');      // bit6
  if (reg66H[0] === '1') serviceStatus.push('Safety Circuit');  // bit7

  // 66L - Power status flags (bit0 = rightmost character)
  const powerStatus = [];
  const reg66L = reg66Split.low;
  if (reg66L[7] === '1') powerStatus.push('Fire Return');        // bit0
  if (reg66L[6] === '1') powerStatus.push('Fire Return In Place'); // bit1
  if (reg66L[5] === '1') powerStatus.push('Standby');            // bit2
  if (reg66L[4] === '1') powerStatus.push('Normal Power');       // bit3
  if (reg66L[3] === '1') powerStatus.push('OEPS');               // bit4
  if (reg66L[2] === '1') powerStatus.push('Standby');            // bit5
  if (reg66L[1] === '1') powerStatus.push('Standby');            // bit6
  if (reg66L[0] === '1') powerStatus.push('Standby');            // bit7

  // Determine overall status
  let overallStatus = 'normal';
  if (primaryStatus.includes('Comprehensive Fault') || primaryStatus.includes('Door Open')) {
    overallStatus = 'error';
  } else if (primaryStatus.includes('Inspection') || serviceStatus.includes('Maintenance ON')) {
    overallStatus = 'warning';
  } else if (primaryStatus.includes('Independent') || primaryStatus.includes('Fire Exclusive')) {
    overallStatus = 'special';
  } else if (primaryStatus.length === 0 && serviceStatus.includes('In Service')) {
    overallStatus = 'active';
  } else {
    overallStatus = 'inactive';
  }

  return {
    floor,
    primaryStatus,
    serviceStatus,
    powerStatus,
    overallStatus
  };
};

export default function ElevatorOverview() {
  // ✅ State for real data
  const [elevators, setElevators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ Fetch real data from API
  const fetchElevatorData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/elevators/recent', {
        withCredentials: true,
        params: { limit: 50 }
      });
      
      if (response.data && response.data.logs) {
        // Process each elevator's data
        const processedElevators = response.data.logs.map(log => {
          const processedData = processElevatorData(log.data);
          return {
            id: log.elevatorId,
            company: log.elevatorCompany,
            location: log.location,
            timestamp: log.timestamp,
            createdAt: log.createdAt,
            data: log.data,
            ...processedData // floor, primaryStatus, serviceStatus, powerStatus, overallStatus
          };
        });
        
        setElevators(processedElevators);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching elevator data:', err);
      setError('Failed to load elevator data');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch data on component mount and set up auto-refresh
  useEffect(() => {
    fetchElevatorData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchElevatorData, 30000);
    return () => clearInterval(interval);
  }, []);

  // ✅ Calculate stats from real data
  const stats = useMemo(() => {
    const active = elevators.filter(e => e.overallStatus === 'active').length;
    const inactive = elevators.filter(e => e.overallStatus === 'inactive').length;
    const error = elevators.filter(e => e.overallStatus === 'error').length;
    return { active, inactive, error, total: elevators.length };
  }, [elevators]);

  const getStatusBadge = (overallStatus) => {
    const variants = {
      active: { bg: "success", text: "Active" },
      inactive: { bg: "secondary", text: "Inactive" },
      error: { bg: "danger", text: "Error" },
      warning: { bg: "warning", text: "Warning" },
      special: { bg: "info", text: "Special" },
      normal: { bg: "success", text: "Normal" },
      unknown: { bg: "dark", text: "Unknown" }
    };
    const variant = variants[overallStatus] || variants.unknown;
    return <Badge bg={variant.bg} className="px-2 py-1">{variant.text}</Badge>;
  };

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={`${styles.mainCO} p-3`}>
      {/* Header */}
      <div className="mb-4">
        <h4 className="mb-1 fw-bold">Elevator Dashboard</h4>
        <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
          Real-time monitoring of elevator systems across all locations
        </p>
      </div>

      {/* Top Status Cards - Blue Theme */}
      <Row className="mb-4">
        <Col xs={12} md={4} className="mb-3">
          <Card className="h-100 border-0 shadow-lg" style={{ 
            background: "linear-gradient(135deg, #1a5f7a 0%, #4facfe 100%)",
            minHeight: '120px',
            borderRadius: '15px'
          }}>
            <Card.Body className="p-4 text-white position-relative">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h2 className="mb-1 fw-bold" style={{ fontSize: '2.5rem' }}>
                    {stats.active}
                  </h2>
                  <p className="mb-0 fw-medium" style={{ fontSize: '1rem', opacity: 0.9 }}>
                    Active Elevators
                  </p>
                </div>
                <div style={{ opacity: 0.8 }}>
                  <PiCheckCircleDuotone size={50} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} md={4} className="mb-3">
          <Card className="h-100 border-0 shadow-lg" style={{ 
            background: "linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)",
            minHeight: '120px',
            borderRadius: '15px'
          }}>
            <Card.Body className="p-4 text-white position-relative">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h2 className="mb-1 fw-bold" style={{ fontSize: '2.5rem' }}>
                    {stats.inactive}
                  </h2>
                  <p className="mb-0 fw-medium" style={{ fontSize: '1rem', opacity: 0.9 }}>
                    Inactive Elevators
                  </p>
                </div>
                <div style={{ opacity: 0.8 }}>
                  <PiXCircleDuotone size={50} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} md={4} className="mb-3">
          <Card className="h-100 border-0 shadow-lg" style={{ 
            background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            minHeight: '120px',
            borderRadius: '15px'
          }}>
            <Card.Body className="p-4 text-white position-relative">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h2 className="mb-1 fw-bold" style={{ fontSize: '2.5rem' }}>
                    {stats.error}
                  </h2>
                  <p className="mb-0 fw-medium" style={{ fontSize: '1rem', opacity: 0.9 }}>
                    Error Status
                  </p>
                </div>
                <div style={{ opacity: 0.8 }}>
                  <PiWarningCircleDuotone size={50} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2 text-muted">Loading elevator data...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="alert alert-danger" role="alert">
          <strong>Error:</strong> {error}
          <button 
            className="btn btn-sm btn-outline-danger ms-2" 
            onClick={fetchElevatorData}
          >
            Retry
          </button>
        </div>
      )}

      {/* Individual Elevator Cards */}
      {!loading && !error && (
        <div className="mb-3">
          <Row>
            {elevators.map((elevator) => (
              <Col xs={12} sm={6} md={4} lg={2} className="mb-3" key={elevator.id}>
                <Card 
                  className="h-100 border-0 shadow-sm elevator-card" 
                  style={{ 
                    borderRadius: '12px',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    backgroundColor: '#f5f5f5'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
                  }}
                >
                  <Card.Body className="p-3">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <Badge bg="dark" className="px-2 py-1" style={{ fontSize: '0.7rem' }}>
                        {elevator.id}
                      </Badge>
                      {getStatusBadge(elevator.overallStatus)}
                    </div>
                    
                    <div className="mb-2">
                      <h6 className="mb-1 fw-bold" style={{ fontSize: '0.85rem' }}>
                        {elevator.company}
                      </h6>
                      <p className="mb-1 text-muted" style={{ fontSize: '0.75rem' }}>
                        {elevator.location}
                      </p>
                    </div>

                    {/* Floor Display */}
                    <div className="mb-2">
                      <small className="fw-bold text-primary" style={{ fontSize: '0.8rem' }}>
                        Floor: {elevator.floor}
                      </small>
                    </div>

                    {/* Primary Status */}
                    {elevator.primaryStatus.length > 0 && (
                      <div className="mb-2">
                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                          Status: {elevator.primaryStatus.join(', ')}
                        </small>
                      </div>
                    )}

                    {/* Service Status */}
                    {elevator.serviceStatus.length > 0 && (
                      <div className="mb-2">
                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                          Service: {elevator.serviceStatus.join(', ')}
                        </small>
                      </div>
                    )}

                    {/* Power Status */}
                    {elevator.powerStatus.length > 0 && (
                      <div className="mb-2">
                        <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                          Power: {elevator.powerStatus.join(', ')}
                        </small>
                      </div>
                    )}

                    <div className="mb-2">
                      <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                        Last Update: {formatTimeAgo(elevator.timestamp || elevator.createdAt)}
                      </small>
                    </div>

                    <div>
                      <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                        Raw Data: {elevator.data ? elevator.data.slice(0, 2).join(', ') : 'N/A'}...
                      </small>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* No Data State */}
      {!loading && !error && elevators.length === 0 && (
        <div className="text-center py-5">
          <PiElevatorDuotone size={64} className="text-muted mb-3" />
          <h5 className="text-muted">No Elevator Data Available</h5>
          <p className="text-muted">No elevator data has been received yet.</p>
        </div>
      )}
    </Col>
  );
} 