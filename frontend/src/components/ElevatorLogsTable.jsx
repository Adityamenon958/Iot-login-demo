import React, { useState, useMemo, useEffect } from 'react';
import { Table, Card, Form, Badge, Button, Row, Col, Spinner } from 'react-bootstrap';
import axios from 'axios';
import styles from './ElevatorLogsTable.module.css';
import RegisterBitDisplay from './RegisterBitDisplay';

// ✅ Binary conversion helpers (same as ElevatorOverview.jsx)
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

// ✅ Format date and time for display
const formatDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// ✅ Get unique values for filter dropdowns
const getUniqueValues = (elevators, key) => {
  const values = [...new Set(elevators.map(e => e[key]))].filter(Boolean);
  return values.sort();
};

// ✅ Get unique status values
const getUniqueStatuses = (elevators) => {
  const statuses = elevators.map(e => e.errorCode || 'Normal');
  return [...new Set(statuses)].filter(Boolean).sort();
};

export default function ElevatorLogsTable({ timeRange, setTimeRange, isRefreshing, lastRefreshTime }) {
  // ✅ State for data fetching
  const [elevators, setElevators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchResultsCount, setSearchResultsCount] = useState(0);
  
  // ✅ State for search, filters, sorting, pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    elevatorId: '',
    inService: '',
    inMaintenance: '',
    status: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // ✅ Data fetching function
  const fetchElevatorData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const offset = (currentPage - 1) * rowsPerPage;
      
      const response = await axios.get('/api/elevators/all-logs', {
        withCredentials: true,
        params: { 
          limit: rowsPerPage,
          offset: offset,
          hours: timeRange,
          sortBy: sortConfig.key,
          sortDirection: sortConfig.direction,
          search: debouncedSearchTerm,
          ...filters
        }
      });
      
      if (response.data && response.data.logs) {
        // Process each elevator's data
        const processedElevators = response.data.logs.map(log => {
          // Process register data (same logic as ElevatorOverview.jsx)
          const reg65 = parseInt(log.data[0]) || 0;
          const reg66 = parseInt(log.data[1]) || 0;
          
          // Convert to binary and split using helper functions
          const reg65Binary = decimalToBinary(reg65, 16);
          const reg65Split = split16BitTo8Bit(reg65Binary);
          
          const reg66Binary = decimalToBinary(reg66, 16);
          const reg66Split = split16BitTo8Bit(reg66Binary);
          
          // Determine floor from register 65H (high 8 bits converted to decimal)
          const floor = binaryToDecimal(reg65Split.high);
          
          // Determine service status from register 66H (same logic as ElevatorOverview.jsx)
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

          // 66L - Power status flags (same logic as ElevatorOverview.jsx)
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

          // ✅ Calculate Priority Score based on Reg 66H and Reg 66L only (same logic as ElevatorOverview.jsx)
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

          // Normal/Running (Green) - Score 1
          const normalStatuses = ['In Service', 'Automatic', 'Car Walking', 'Normal Power', 'Safety Circuit'];
          const normalFound = [...serviceStatus, ...powerStatus]
            .filter(status => normalStatuses.includes(status));
          if (normalFound.length > 0 && maxScore < 4) {
            maxScore = Math.max(maxScore, 1);
            criticalStatus = normalFound[0];
          }

          // Determine color and status based on priority score
          let priorityColor = 'gray';
          let priorityStatus = 'Unknown';
          let overallStatus = 'unknown';

          if (maxScore >= 6) {
            priorityColor = 'red';
            priorityStatus = criticalStatus; // ✅ Use specific error name instead of 'Critical'
            overallStatus = 'error';
          } else if (maxScore === 4) {
            priorityColor = 'orange';
            priorityStatus = criticalStatus; // ✅ Use specific status name
            overallStatus = 'warning';
          } else if (maxScore === 1) {
            priorityColor = 'green';
            priorityStatus = criticalStatus; // ✅ Use specific status name
            overallStatus = 'active';
          } else {
            priorityColor = 'gray';
            priorityStatus = criticalStatus; // ✅ Use specific status name
            overallStatus = 'inactive';
          }
          
          return {
            _id: `${log.elevatorId}-${log.timestamp}-${log._id}`,
            timestamp: log.timestamp,
            timestampDisplay: formatDateTime(log.timestamp),
            id: log.elevatorId,
            company: log.elevatorCompany,
            location: log.location,
            floor: floor,
            inService: serviceStatus.includes('In Service'),
            inMaintenance: serviceStatus.includes('Maintenance ON'),
            errorCode: priorityStatus,
            priorityColor: priorityColor,
            registerBits: {
              reg65L: {
                bits: reg65Split.low.split(''), // Use exact same logic as original
                labels: ['Door Open', 'Attendant', 'Independent', 'Fire Exclusive', 'Inspection', 'Comprehensive Fault', 'Down', 'Up']
              },
              reg66H: {
                bits: reg66Split.high.split(''), // Use exact same logic as original
                labels: ['In Service', 'Comm Normal', 'Maintenance ON', 'Overload', 'Automatic', 'Car Walking', 'Earthquake', 'Safety Circuit']
              },
              reg66L: {
                bits: reg66Split.low.split(''), // Use exact same logic as original
                labels: ['Fire Return', 'Fire Return In Place', 'Standby', 'Normal Power', 'OEPS', 'Standby', 'Standby', 'Standby']
              }
            }
          };
        });
        
        setElevators(processedElevators);
        setTotalCount(response.data.total || 0);
        setHasMore(response.data.hasMore || false);
        setSearchResultsCount(processedElevators.length);
      }
    } catch (err) {
      console.error('Error fetching elevator data:', err);
      setError('Failed to load elevator data');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // ✅ Fetch data when dependencies change
  useEffect(() => {
    fetchElevatorData();
  }, [currentPage, rowsPerPage, timeRange, sortConfig, debouncedSearchTerm, filters]);

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

  // ✅ Data is already processed in fetchElevatorData - use directly

  // ✅ Server-side filtering, sorting, and pagination - use data directly
  const paginatedData = elevators; // Data is already processed from server

  // ✅ Calculate pagination values from server data
  const totalPages = Math.ceil(totalCount / rowsPerPage);
  const startRow = totalCount === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endRow = Math.min(currentPage * rowsPerPage, totalCount);

  // ✅ Handle sorting
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  // ✅ Handle filter change
  const handleFilterChange = (filterKey, value) => {
    setFilters(prev => ({ ...prev, [filterKey]: value }));
    setCurrentPage(1); // Reset to first page on filter
  };

  // ✅ Handle search change
  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page on search
  };

  // ✅ Clear search
  const clearSearch = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setCurrentPage(1);
  };

  // ✅ Clear all filters
  const clearFilters = () => {
    setFilters({
      elevatorId: '',
      inService: '',
      inMaintenance: '',
      status: ''
    });
    setSearchTerm('');
    setCurrentPage(1);
  };

  // ✅ Pagination controls
  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleRowsPerPageChange = (value) => {
    setRowsPerPage(Number(value));
    setCurrentPage(1);
  };

  // ✅ Get sort indicator
  const getSortIndicator = (columnKey) => {
    if (sortConfig.key !== columnKey) return ' ⇅';
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  // ✅ Get badge color based on status
  const getStatusBadgeColor = (priorityColor) => {
    const colorMap = {
      'red': 'danger',
      'orange': 'warning',
      'yellow': 'warning',
      'green': 'success',
      'blue': 'info',
      'gray': 'secondary'
    };
    return colorMap[priorityColor] || 'secondary';
  };

  // ✅ Get unique options for filters
  const elevatorIds = getUniqueValues(elevators, 'id');
  const statuses = getUniqueStatuses(elevators);

  return (
    <Card className={`${styles.tableCard} border-0 shadow-sm mt-4`}>
      <Card.Header className="bg-white border-bottom py-3">
        <Row className="align-items-center">
          <Col xs={12} md={6}>
            <h6 className="mb-0 fw-bold">
              📊 Elevator Activity Logs
              <small className="text-muted ms-2" style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>
                ({paginatedData.length} {paginatedData.length === 1 ? 'log' : 'logs'})
              </small>
            </h6>
          </Col>
          <Col xs={12} md={6} className="mt-2 mt-md-0">
            <div className="d-flex justify-content-between align-items-center" style={{
              minHeight: '32px',
              paddingTop: '4px',
              paddingBottom: '4px'
            }}>
              <div className="d-flex align-items-center">
                <Form.Control
                  type="text"
                  placeholder="Search all columns..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className={styles.searchInput}
                  size="sm"
                  style={{ maxWidth: '300px' }}
                />
                {searchTerm && (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={clearSearch}
                    className="ms-1"
                    style={{ padding: '0.25rem 0.5rem' }}
                  >
                    ×
                  </Button>
                )}
              </div>
              {debouncedSearchTerm && (
                <small className="text-muted ms-2">
                  {searchResultsCount} results
                </small>
              )}
              <RefreshIndicator 
                isRefreshing={isRefreshing}
                lastRefreshTime={lastRefreshTime}
              />
            </div>
          </Col>
        </Row>
      </Card.Header>

      <Card.Body className="p-0">
        {/* Time Range Selector */}
        <div className={styles.filterRow} style={{ borderBottom: '1px solid #dee2e6', paddingBottom: '10px' }}>
          <Row className="align-items-center">
            <Col xs={12}>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <small className="text-muted fw-bold">Time Range:</small>
                <Button 
                  size="sm" 
                  variant={timeRange === '1' ? 'primary' : 'outline-secondary'}
                  onClick={() => setTimeRange('1')}
                  style={{ fontSize: '0.8rem' }}
                >
                  Last 1 Hour
                </Button>
                <Button 
                  size="sm" 
                  variant={timeRange === '6' ? 'primary' : 'outline-secondary'}
                  onClick={() => setTimeRange('6')}
                  style={{ fontSize: '0.8rem' }}
                >
                  Last 6 Hours
                </Button>
                <Button 
                  size="sm" 
                  variant={timeRange === '24' ? 'primary' : 'outline-secondary'}
                  onClick={() => setTimeRange('24')}
                  style={{ fontSize: '0.8rem' }}
                >
                  Last 24 Hours
                </Button>
                <Button 
                  size="sm" 
                  variant={timeRange === '168' ? 'primary' : 'outline-secondary'}
                  onClick={() => setTimeRange('168')}
                  style={{ fontSize: '0.8rem' }}
                >
                  Last 7 Days
                </Button>
                <small className="text-muted ms-2">
                  ({elevators.length} logs loaded)
                </small>
              </div>
            </Col>
          </Row>
        </div>

        {/* Filter Row */}
        <div className={styles.filterRow}>
          <Row className="g-2 align-items-center">
            <Col xs={6} md={2}>
              <Form.Select
                size="sm"
                value={filters.elevatorId}
                onChange={(e) => handleFilterChange('elevatorId', e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">All Elevators</option>
                {elevatorIds.map(id => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={6} md={2}>
              <Form.Select
                size="sm"
                value={filters.inService}
                onChange={(e) => handleFilterChange('inService', e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">In Service: All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Form.Select>
            </Col>
            <Col xs={6} md={2}>
              <Form.Select
                size="sm"
                value={filters.inMaintenance}
                onChange={(e) => handleFilterChange('inMaintenance', e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">Maintenance: All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Form.Select>
            </Col>
            <Col xs={6} md={2}>
              <Form.Select
                size="sm"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">All Status</option>
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={12} md={4} className="text-end">
              <Button 
                variant="outline-secondary" 
                size="sm"
                onClick={clearFilters}
                disabled={!debouncedSearchTerm && !filters.elevatorId && !filters.inService && !filters.inMaintenance && !filters.status}
              >
                Clear Filters
              </Button>
            </Col>
          </Row>
        </div>

        {/* Table */}
        <div className={styles.tableWrapper}>
          <Table striped hover responsive className={styles.customTable}>
            <thead>
              <tr>
                <th onClick={() => handleSort('timestamp')} className={styles.sortable}>
                  Date & Time{getSortIndicator('timestamp')}
                </th>
                <th>
                  Elevator ID
                </th>
                <th>
                  Company
                </th>
                <th>
                  Location
                </th>
                <th style={{ textAlign: 'center' }}>
                  Floor
                </th>
                <th style={{ textAlign: 'center' }}>
                  In Service
                </th>
                <th style={{ textAlign: 'center' }}>
                  Maintenance
                </th>
                <th>
                  Status / Error
                </th>
                <th style={{ textAlign: 'center', minWidth: '200px' }}>
                  Register Bits
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center text-muted py-4">
                    No elevator logs found
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => (
                  <tr key={row._id}>
                    <td style={{ fontSize: '0.85rem' }}>{row.timestampDisplay}</td>
                    <td>
                      <Badge bg="dark" style={{ fontSize: '0.8rem' }}>
                        {row.id}
                      </Badge>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{row.company}</td>
                    <td style={{ fontSize: '0.85rem' }}>{row.location}</td>
                    <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>{row.floor}</td>
                    <td style={{ textAlign: 'center' }}>
                      <Badge bg={row.inService ? 'success' : 'danger'} style={{ fontSize: '0.75rem' }}>
                        {row.inService ? ' Yes' : '❌ No'}
                      </Badge>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Badge bg={row.inMaintenance ? 'warning' : 'secondary'} style={{ fontSize: '0.75rem' }}>
                        {row.inMaintenance ? ' Yes' : '—'}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg={getStatusBadgeColor(row.priorityColor)} style={{ fontSize: '0.75rem' }}>
                        {row.errorCode}
                      </Badge>
                    </td>
                    <td style={{ verticalAlign: 'top', padding: '4px' }}>
                      {row.registerBits && row.registerBits.reg65L && (
                        <>
                          <RegisterBitDisplay 
                            registerData={row.registerBits.reg65L} 
                            registerName="65L" 
                          />
                          <RegisterBitDisplay 
                            registerData={row.registerBits.reg66H} 
                            registerName="66H" 
                          />
                          <RegisterBitDisplay 
                            registerData={row.registerBits.reg66L} 
                            registerName="66L" 
                          />
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>

        {/* Pagination */}
        <div className={styles.paginationWrapper}>
          <Row className="align-items-center">
            <Col xs={12} md={4} className="mb-2 mb-md-0">
              <small className="text-muted">
                Showing {startRow} to {endRow} of {totalCount} logs
              </small>
            </Col>
            <Col xs={12} md={4} className="text-center mb-2 mb-md-0">
              <div className={styles.paginationControls}>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className={styles.pageButton}
                >
                  ⏮
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={styles.pageButton}
                >
                  ◄
                </Button>
                <span className={styles.pageInfo}>
                  Page {currentPage} of {totalPages || 1}
                </span>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className={styles.pageButton}
                >
                  ►
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className={styles.pageButton}
                >
                  ⏭
                </Button>
              </div>
            </Col>
            <Col xs={12} md={4} className="text-md-end">
              <Form.Select
                size="sm"
                value={rowsPerPage}
                onChange={(e) => handleRowsPerPageChange(e.target.value)}
                style={{ width: 'auto', display: 'inline-block' }}
                className={styles.rowsSelect}
              >
                <option value="10">10 rows</option>
                <option value="20">20 rows</option>
                <option value="50">50 rows</option>
                <option value="100">100 rows</option>
              </Form.Select>
            </Col>
          </Row>
        </div>
      </Card.Body>
    </Card>
  );
}

