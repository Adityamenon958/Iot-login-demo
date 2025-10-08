import React, { useEffect, useState, useMemo } from 'react';
import { Col, Row, Card, Badge, Spinner } from 'react-bootstrap';
import axios from 'axios';
import styles from "./MainContent.module.css";
import { PiElevatorDuotone, PiCheckCircleDuotone, PiXCircleDuotone, PiWarningCircleDuotone } from "react-icons/pi";
import ElevatorTooltip from '../components/ElevatorTooltip';
import ElevatorLogsTable from '../components/ElevatorLogsTable';

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
      overallStatus: 'unknown',
      priorityScore: 0,
      priorityColor: 'gray',
      priorityStatus: 'Unknown'
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

  // ✅ Calculate Priority Score based on Reg 66H and Reg 66L only (Reg 65L removed from priority)
  let maxScore = 0;
  let criticalStatus = '';

  // Critical/Emergency (Red) - Score 6
  const criticalStatuses = [
    'Overload', 'Earthquake', 'OEPS', 
    'Fire Return', 'Fire Return In Place'
  ];
  const criticalFound = [...serviceStatus, ...powerStatus]
    .filter(status => criticalStatuses.includes(status));
  if (criticalFound.length > 0) {
    maxScore = Math.max(maxScore, 6);
    criticalStatus = criticalFound[0];
  }

  // Check for communication fault (Comm Normal = 0 means abnormal)
  if (serviceStatus.includes('Comm Normal') === false && reg66H[6] === '0') {
    maxScore = Math.max(maxScore, 6);
    criticalStatus = 'Comm Fault';
  }

  // Check for out of service (In Service = 0)
  if (serviceStatus.includes('In Service') === false && reg66H[7] === '0') {
    maxScore = Math.max(maxScore, 0); // Gray for out of service
    criticalStatus = 'Out of Service';
  }

  // Maintenance/Inspection (Orange) - Score 4
  const maintenanceStatuses = ['Maintenance ON'];
  const maintenanceFound = [...serviceStatus]
    .filter(status => maintenanceStatuses.includes(status));
  if (maintenanceFound.length > 0 && maxScore < 6) {
    maxScore = Math.max(maxScore, 4);
    criticalStatus = maintenanceFound[0];
  }

  // Warning (Yellow) - Score 3 - Removed (Reg 65L bits no longer used in priority)

  // Normal/Running (Green) - Score 1
  const normalStatuses = ['In Service', 'Automatic', 'Car Walking', 'Normal Power', 'Safety Circuit'];
  const normalFound = [...serviceStatus, ...powerStatus]
    .filter(status => normalStatuses.includes(status));
  if (normalFound.length > 0 && maxScore < 4) {
    maxScore = Math.max(maxScore, 1);
    criticalStatus = normalFound[0];
  }

  // Info/Mode (Blue) - Score 0 - Removed (Reg 65L bits no longer used in priority)

  // Determine color and status based on priority score
  let priorityColor = 'gray';
  let priorityStatus = 'Unknown';
  let overallStatus = 'unknown';

  if (maxScore >= 6) {
    priorityColor = 'red';
    priorityStatus = 'Critical';
    overallStatus = 'error';
  } else if (maxScore === 4) {
    priorityColor = 'orange';
    priorityStatus = 'Maintenance';
    overallStatus = 'warning';
  } else if (maxScore === 1) {
    priorityColor = 'green';
    priorityStatus = 'Normal';
    overallStatus = 'active';
  } else {
    priorityColor = 'gray';
    priorityStatus = 'Out of Service';
    overallStatus = 'inactive';
  }

  return {
    floor,
    primaryStatus,
    serviceStatus,
    powerStatus,
    overallStatus,
    priorityScore: maxScore,
    priorityColor,
    priorityStatus,
    criticalStatus
  };
};

export default function ElevatorOverview() {
  // ✅ State for historical logs table (ALL logs)
  const [elevators, setElevators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ State for individual elevator cards (latest status per elevator)
  const [individualElevators, setIndividualElevators] = useState([]);
  const [individualCardsLoading, setIndividualCardsLoading] = useState(true);
  const [individualCardsError, setIndividualCardsError] = useState(null);

  // ✅ State for time range filter
  const [timeRange, setTimeRange] = useState('24'); // hours

  // ✅ Background refresh states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isIndividualRefreshing, setIsIndividualRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);

  // ✅ Fetch data for historical logs table (ALL LOGS with pagination)
  const fetchElevatorData = async (isBackgroundRefresh = false) => {
    try {
      if (!isBackgroundRefresh) {
        setLoading(true); // Only show full spinner on initial load
      } else {
        setIsRefreshing(true); // Show subtle indicator for background refresh
      }
      
      const response = await axios.get('/api/elevators/all-logs', {
        withCredentials: true,
        params: { 
          limit: 500,           // Fetch 500 logs
          offset: 0,            // Start from beginning
          hours: timeRange      // Time range filter
        }
      });
      
      if (response.data && response.data.logs) {
        console.log('🔍 API Response (Historical Logs):', response.data);
        // Process each elevator's data
        const processedElevators = response.data.logs.map(log => {
          console.log('🔍 Processing elevator:', log.elevatorId, 'Working Hours:', log.workingHours);
          const processedData = processElevatorData(log.data);
          return {
            id: log.elevatorId,
            company: log.elevatorCompany,
            location: log.location,
            timestamp: log.timestamp,
            createdAt: log.createdAt,
            data: log.data,
            workingHours: log.workingHours, // ✅ Pass through working hours from backend
            maintenanceHours: log.maintenanceHours, // ✅ Pass through maintenance hours from backend
            ...processedData // floor, primaryStatus, serviceStatus, powerStatus, overallStatus
          };
        });
        
        setElevators(processedElevators);
        setError(null);
        setLastRefreshTime(new Date());
      }
    } catch (err) {
      console.error('Error fetching historical elevator data:', err);
      if (!isBackgroundRefresh) {
        setError('Failed to load historical elevator data');
      }
      // Don't show error for background refresh - keep existing data
    } finally {
      if (!isBackgroundRefresh) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  // ✅ Fetch data for individual elevator cards (latest status per elevator)
  const fetchIndividualElevatorData = async (isBackgroundRefresh = false) => {
    try {
      if (!isBackgroundRefresh) {
        setIndividualCardsLoading(true);
        setIndividualCardsError(null);
      } else {
        setIsIndividualRefreshing(true);
      }
      
      const response = await axios.get('/api/elevators/recent', {
        withCredentials: true,
        params: { limit: 50 }
      });
      
      if (response.data && response.data.logs) {
        console.log('🔍 API Response (Individual Cards):', response.data);
        // Process each elevator's data (same logic as before)
        const processedElevators = response.data.logs.map(log => {
          console.log('🔍 Processing individual elevator:', log.elevatorId, 'Working Hours:', log.workingHours);
          const processedData = processElevatorData(log.data);
          return {
            id: log.elevatorId,
            company: log.elevatorCompany,
            location: log.location,
            timestamp: log.timestamp,
            createdAt: log.createdAt,
            data: log.data,
            workingHours: log.workingHours, // ✅ Pass through working hours from backend
            maintenanceHours: log.maintenanceHours, // ✅ Pass through maintenance hours from backend
            ...processedData // floor, primaryStatus, serviceStatus, powerStatus, overallStatus
          };
        });
        
        setIndividualElevators(processedElevators);
      }
    } catch (err) {
      console.error('❌ Error fetching individual elevator data:', err);
      if (!isBackgroundRefresh) {
        setIndividualCardsError('Failed to load individual elevator data');
      }
      // Don't show error for background refresh - keep existing data
    } finally {
      if (!isBackgroundRefresh) {
        setIndividualCardsLoading(false);
      } else {
        setIsIndividualRefreshing(false);
      }
    }
  };

  // ✅ Fetch historical logs data on component mount and set up auto-refresh
  useEffect(() => {
    fetchElevatorData(false); // Initial load with spinner
    
    // Auto-refresh every 30 seconds with background refresh
    const interval = setInterval(() => {
      fetchElevatorData(true); // Background refresh
    }, 30000);
    
    return () => clearInterval(interval);
  }, [timeRange]); // Re-fetch when time range changes

  // ✅ Fetch individual elevator data on component mount and set up auto-refresh
  useEffect(() => {
    fetchIndividualElevatorData(false); // Initial load with spinner
    
    // Auto-refresh every 30 seconds with background refresh
    const interval = setInterval(() => {
      fetchIndividualElevatorData(true); // Background refresh
    }, 30000);
    
    return () => clearInterval(interval);
  }, []); // No dependencies - runs once on mount

  // ✅ Calculate stats from individual elevator data (latest status per elevator)
  const stats = useMemo(() => {
    // ✅ Active = In Service bit is active (independent of priority scoring)
    const activeList = individualElevators.filter(e => e.serviceStatus.includes('In Service'));
    
    // ✅ Inactive = In Service bit is NOT active (independent of priority scoring)
    const inactiveList = individualElevators.filter(e => !e.serviceStatus.includes('In Service'));
    
    // ✅ Error = Priority-based (unchanged - shows critical issues)
    const errorList = individualElevators.filter(e => e.overallStatus === 'error');
    
    return { 
      active: activeList.length,
      activeList,
      inactive: inactiveList.length,
      inactiveList,
      error: errorList.length,
      errorList,
      total: individualElevators.length 
    };
  }, [individualElevators]); // ✅ Use individualElevators for stats

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

  // ✅ Helper function to format time ago
  const formatTimeAgo = (date) => {
    if (!date) return '';
    const now = new Date();
    const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  // ✅ Subtle refresh indicator component
  const RefreshIndicator = ({ isRefreshing, lastRefreshTime }) => {
    if (!isRefreshing && !lastRefreshTime) return null;
    
    return (
      <div className="d-flex align-items-center gap-2" style={{ fontSize: '0.8rem' }}>
        {isRefreshing && (
          <Spinner animation="border" size="sm" variant="primary" />
        )}
        <span className="text-muted">
          {isRefreshing ? 'Refreshing...' : `Last updated: ${formatTimeAgo(lastRefreshTime)}`}
        </span>
      </div>
    );
  };

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={`${styles.mainCO} p-3`}>
      {/* Header */}
      <div className="mb-4">
        <h4 className="mb-1 fw-bold">Elevator Dashboard</h4>
         <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
           Periodic monitoring of elevator systems
         </p>
      </div>

      {/* Top Status Cards - Blue Theme */}
      <Row className="mb-0">
        <Col xs={12} md={4} className="mb-3">
          <ElevatorTooltip elevators={stats.activeList} title="Active Elevators">
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
          </ElevatorTooltip>
        </Col>

        <Col xs={12} md={4} className="mb-3">
          <ElevatorTooltip elevators={stats.inactiveList} title="Inactive Elevators">
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
          </ElevatorTooltip>
        </Col>

        <Col xs={12} md={4} className="mb-3">
          <ElevatorTooltip elevators={stats.errorList} title="Error Status">
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
          </ElevatorTooltip>
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

      {/* Individual Elevator Cards - SINGLE ROW WITH HORIZONTAL SCROLL */}
      {individualCardsLoading && (
        <div className="text-center my-4">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2 text-muted">Loading individual elevator statuses...</p>
        </div>
      )}
      {individualCardsError && (
        <div className="alert alert-danger" role="alert">
          <strong>Error:</strong> {individualCardsError}
          <button 
            className="btn btn-sm btn-outline-danger ms-2" 
            onClick={fetchIndividualElevatorData}
          >
            Retry
          </button>
        </div>
      )}
      {!individualCardsLoading && !individualCardsError && individualElevators.length > 0 && (
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-0">
            <h6 className="mb-0 fw-bold" style={{ fontSize: '0.95rem' }}>
              Elevator Status
            </h6>
            <RefreshIndicator 
              isRefreshing={isIndividualRefreshing}
              lastRefreshTime={lastRefreshTime}
            />
          </div>
          
          {/* Horizontal scroll container */}
          <div 
            style={{ 
              overflowX: 'auto',
              overflowY: 'hidden',
              whiteSpace: 'nowrap',
              scrollbarWidth: 'thin',
              scrollbarColor: '#4facfe #f1f3f5',
              paddingTop: '15px',
              paddingBottom: '10px',
              marginBottom: '10px'
            }}
          >
            <div 
              style={{ 
                display: 'inline-flex',
                gap: '12px',
                minHeight: '290px'
              }}
            >
              {individualElevators.map((elevator) => {
                // ✅ Get color mapping based on priority
                const getPriorityColor = (color) => {
                  const colorMap = {
                    'red': '#dc3545',      // Critical/Emergency
                    'orange': '#fd7e14',   // Maintenance/Inspection  
                    'yellow': '#ffc107',   // Warning
                    'green': '#198754',    // Normal/Running
                    'blue': '#0d6efd',     // Info/Mode
                    'gray': '#6c757d'      // Standby/Out of Service
                  };
                  return colorMap[color] || '#6c757d';
                };

                const borderColor = getPriorityColor(elevator.priorityColor);

                // ✅ Get background fade color based on priority
                const getBackgroundFade = (color) => {
                  const fadeMap = {
                    'red': 'rgba(220, 53, 69, 0.25)',      // Critical/Emergency
                    'orange': 'rgba(253, 126, 20, 0.25)',   // Maintenance/Inspection
                    'yellow': 'rgba(255, 193, 7, 0.25)',    // Warning
                    'green': 'rgba(25, 135, 84, 0.25)',     // Normal/Running
                    'blue': 'rgba(13, 110, 253, 0.25)',     // Info/Mode
                    'gray': 'rgba(108, 117, 125, 0.25)'     // Standby/Out of Service
                  };
                  return fadeMap[color] || 'rgba(108, 117, 125, 0.25)';
                };

                // ✅ Get colored shadow based on priority
                const getColoredShadow = (color) => {
                  const shadowMap = {
                    'red': '0 4px 15px rgba(220, 53, 69, 0.3), 0 2px 8px rgba(220, 53, 69, 0.2)',
                    'orange': '0 4px 15px rgba(253, 126, 20, 0.3), 0 2px 8px rgba(253, 126, 20, 0.2)',
                    'yellow': '0 4px 15px rgba(255, 193, 7, 0.3), 0 2px 8px rgba(255, 193, 7, 0.2)',
                    'green': '0 4px 15px rgba(25, 135, 84, 0.3), 0 2px 8px rgba(25, 135, 84, 0.2)',
                    'blue': '0 4px 15px rgba(13, 110, 253, 0.3), 0 2px 8px rgba(13, 110, 253, 0.2)',
                    'gray': '0 4px 15px rgba(108, 117, 125, 0.3), 0 2px 8px rgba(108, 117, 125, 0.2)'
                  };
                  return shadowMap[color] || '0 4px 15px rgba(108, 117, 125, 0.3), 0 2px 8px rgba(108, 117, 125, 0.2)';
                };

                const backgroundFade = getBackgroundFade(elevator.priorityColor);
                const coloredShadow = getColoredShadow(elevator.priorityColor);

                return (
                  <div 
                    key={elevator.id}
                    style={{ 
                      flex: '0 0 auto',
                      width: '220px',
                      display: 'inline-block'
                    }}
                  >
                    <Card 
                      className="h-100 border-0 elevator-card position-relative" 
                      style={{ 
                        borderRadius: '12px',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        backgroundColor: '#f5f5f5',
                        borderLeft: `4px solid ${borderColor}`,
                        background: `linear-gradient(to right, ${backgroundFade} 0%, ${backgroundFade} 20%, #f5f5f5 50%, #f5f5f5 100%)`,
                        boxShadow: coloredShadow,
                        maxHeight: '280px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-5px)';
                        e.currentTarget.style.boxShadow = `${coloredShadow}, 0 8px 25px rgba(0,0,0,0.15)`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = coloredShadow;
                      }}
                    >
                      <Card.Body className="p-2">
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <Badge bg="dark" className="px-2 py-1" style={{ fontSize: '0.7rem' }}>
                            {elevator.id}
                          </Badge>
                        </div>
                        
                        <div className="mb-1">
                          <h6 className="mb-0 fw-bold" style={{ fontSize: '0.85rem' }}>
                            {elevator.company}
                          </h6>
                          <p className="mb-0 text-muted" style={{ fontSize: '0.75rem' }}>
                            {elevator.location}
                          </p>
                        </div>

                        {/* Floor Display */}
                        <div className="mb-1">
                          <small className="fw-bold text-primary" style={{ fontSize: '0.8rem' }}>
                            Floor: {elevator.floor}
                          </small>
                        </div>

                        {/* In Service / Out of Service */}
                        <div className="mb-0">
                          <small className="fw-bold" style={{ 
                            fontSize: '0.8rem',
                            color: elevator.serviceStatus.includes('In Service') ? '#28a745' : '#dc3545'
                          }}>
                            {elevator.serviceStatus.includes('In Service') ? 'In Service' : 'Out of Service'}
                          </small>
                        </div>

                        {/* Working Hours Display */}
                        {elevator.workingHours && (
                          <>
                            <div className="mb-0">
                              <small className="fw-bold text-info" style={{ fontSize: '0.75rem' }}>
                                Total Working: {elevator.workingHours.formatted}
                              </small>
                            </div>
                            {elevator.workingHours.currentSession && (
                              <div className="mb-0">
                                <small className="fw-bold" style={{ fontSize: '0.75rem', color: '#28a745', display: 'block' }}>
                                  Current Session: {elevator.workingHours.currentSession.formatted}
                                </small>
                                <small style={{ fontSize: '0.6rem', color: '#666', display: 'block' }}>
                                  ({elevator.workingHours.currentSession.start})
                                </small>
                              </div>
                            )}
                          </>
                        )}

                        {/* Maintenance Status and Hours */}
                        {elevator.serviceStatus.includes('Maintenance ON') && (
                          <>
                            <div className="mb-0">
                              <small className="fw-bold" style={{ 
                                fontSize: '0.8rem',
                                color: '#fd7e14'
                              }}>
                                In Maintenance
                              </small>
                            </div>
                            {elevator.maintenanceHours && elevator.maintenanceHours.currentSession && (
                              <div className="mb-0">
                                <small className="fw-bold" style={{ fontSize: '0.75rem', color: '#fd7e14', display: 'block' }}>
                                  Current Maintenance: {elevator.maintenanceHours.currentSession.formatted}
                                </small>
                                <small style={{ fontSize: '0.6rem', color: '#666', display: 'block' }}>
                                  ({elevator.maintenanceHours.currentSession.start})
                                </small>
                              </div>
                            )}
                          </>
                        )}

                        {/* Last Update */}
                        <div className="mt-1">
                          <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                            Last Update: {formatTimeAgo(elevator.timestamp || elevator.createdAt)}
                          </small>
                        </div>
                      </Card.Body>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Scroll hint */}
          {individualElevators.length > 5 && (
            <small className="text-muted d-block text-center" style={{ fontSize: '0.75rem' }}>
              ← Scroll horizontally to see all elevators →
            </small>
          )}
        </div>
      )}

      {/* Elevator Logs Table */}
      {!loading && !error && elevators.length > 0 && (
        <ElevatorLogsTable 
          elevators={elevators} 
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          isRefreshing={isRefreshing}
          lastRefreshTime={lastRefreshTime}
        />
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