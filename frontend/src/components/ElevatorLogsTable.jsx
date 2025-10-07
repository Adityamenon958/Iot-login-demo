import React, { useState, useMemo } from 'react';
import { Table, Card, Form, Badge, Button, Row, Col, Spinner } from 'react-bootstrap';
import styles from './ElevatorLogsTable.module.css';

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
  const statuses = elevators.map(e => e.criticalStatus || e.priorityStatus || 'Normal');
  return [...new Set(statuses)].filter(Boolean).sort();
};

export default function ElevatorLogsTable({ elevators, timeRange, setTimeRange, isRefreshing, lastRefreshTime }) {
  // ✅ State for search, filters, sorting, pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    elevatorId: '',
    inService: '',
    inMaintenance: '',
    status: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

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

  // ✅ Transform elevator data for table
  const tableData = useMemo(() => {
    return elevators.map((elevator, index) => ({
      _id: `${elevator.id}-${elevator.timestamp}-${index}`,
      timestamp: elevator.timestamp || elevator.createdAt,
      timestampDisplay: formatDateTime(elevator.timestamp || elevator.createdAt),
      id: elevator.id,
      company: elevator.company,
      location: elevator.location,
      floor: elevator.floor,
      inService: elevator.serviceStatus.includes('In Service'),
      inMaintenance: elevator.serviceStatus.includes('Maintenance ON'),
      errorCode: elevator.criticalStatus || elevator.priorityStatus || 'Normal',
      priorityColor: elevator.priorityColor,
      priorityScore: elevator.priorityScore
    }));
  }, [elevators]);

  // ✅ Apply search filter
  const searchedData = useMemo(() => {
    if (!searchTerm) return tableData;
    
    const lowerSearch = searchTerm.toLowerCase();
    return tableData.filter(row => 
      row.timestampDisplay.toLowerCase().includes(lowerSearch) ||
      row.id.toLowerCase().includes(lowerSearch) ||
      row.company.toLowerCase().includes(lowerSearch) ||
      row.location.toLowerCase().includes(lowerSearch) ||
      row.floor.toString().includes(lowerSearch) ||
      row.errorCode.toLowerCase().includes(lowerSearch)
    );
  }, [tableData, searchTerm]);

  // ✅ Apply column filters
  const filteredData = useMemo(() => {
    return searchedData.filter(row => {
      if (filters.elevatorId && row.id !== filters.elevatorId) return false;
      if (filters.inService !== '' && row.inService !== (filters.inService === 'true')) return false;
      if (filters.inMaintenance !== '' && row.inMaintenance !== (filters.inMaintenance === 'true')) return false;
      if (filters.status && row.errorCode !== filters.status) return false;
      return true;
    });
  }, [searchedData, filters]);

  // ✅ Apply sorting
  const sortedData = useMemo(() => {
    let sorted = [...filteredData];
    if (sortConfig.key) {
      sorted.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        // Handle timestamp sorting
        if (sortConfig.key === 'timestamp') {
          aVal = new Date(aVal).getTime();
          bVal = new Date(bVal).getTime();
        }
        
        // Handle boolean sorting
        if (typeof aVal === 'boolean') {
          aVal = aVal ? 1 : 0;
          bVal = bVal ? 1 : 0;
        }
        
        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sorted;
  }, [filteredData, sortConfig]);

  // ✅ Apply pagination
  const paginatedData = useMemo(() => {
    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    return sortedData.slice(indexOfFirstRow, indexOfLastRow);
  }, [sortedData, currentPage, rowsPerPage]);

  // ✅ Calculate pagination values
  const totalPages = Math.ceil(sortedData.length / rowsPerPage);
  const startRow = sortedData.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endRow = Math.min(currentPage * rowsPerPage, sortedData.length);

  // ✅ Handle sorting
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // Reset to first page on sort
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
                ({sortedData.length} {sortedData.length === 1 ? 'log' : 'logs'})
              </small>
            </h6>
          </Col>
          <Col xs={12} md={6} className="mt-2 mt-md-0">
            <div className="d-flex justify-content-between align-items-center" style={{
              minHeight: '32px',
              paddingTop: '4px',
              paddingBottom: '4px'
            }}>
              <Form.Control
                type="text"
                placeholder="🔍 Search all columns..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className={styles.searchInput}
                size="sm"
                style={{ maxWidth: '300px' }}
              />
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
                disabled={!searchTerm && !filters.elevatorId && !filters.inService && !filters.inMaintenance && !filters.status}
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
                <th onClick={() => handleSort('id')} className={styles.sortable}>
                  Elevator ID{getSortIndicator('id')}
                </th>
                <th onClick={() => handleSort('company')} className={styles.sortable}>
                  Company{getSortIndicator('company')}
                </th>
                <th onClick={() => handleSort('location')} className={styles.sortable}>
                  Location{getSortIndicator('location')}
                </th>
                <th onClick={() => handleSort('floor')} className={styles.sortable} style={{ textAlign: 'center' }}>
                  Floor{getSortIndicator('floor')}
                </th>
                <th onClick={() => handleSort('inService')} className={styles.sortable} style={{ textAlign: 'center' }}>
                  In Service{getSortIndicator('inService')}
                </th>
                <th onClick={() => handleSort('inMaintenance')} className={styles.sortable} style={{ textAlign: 'center' }}>
                  Maintenance{getSortIndicator('inMaintenance')}
                </th>
                <th onClick={() => handleSort('errorCode')} className={styles.sortable}>
                  Status / Error{getSortIndicator('errorCode')}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted py-4">
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
                Showing {startRow} to {endRow} of {sortedData.length} logs
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

