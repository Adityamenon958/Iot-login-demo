import React, { useState, useEffect } from 'react';
import { Card, Form, Row, Col, Badge } from 'react-bootstrap';
import axios from 'axios';

// ✅ Helper function to convert decimal hours to hours and minutes format
function formatHoursToHoursMinutes(decimalHours) {
  if (!decimalHours || decimalHours === 0) return '0h 0m';
  
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  
  // Handle edge case where minutes round to 60
  if (minutes === 60) {
    return `${hours + 1}h 0m`;
  }
  
  return `${hours}h ${minutes}m`;
}

// ✅ Helper function to format timestamp for display
function formatTimestamp(timestamp) {
  if (timestamp === "Ongoing") return "Ongoing";
  
  try {
    const [datePart, timePart] = timestamp.split(' ');
    const [day, month, year] = datePart.split('/');
    const [hour, minute] = timePart.split(':');
    return `${day}/${month} ${hour}:${minute}`;
  } catch (err) {
    return timestamp;
  }
}

export default function MaintenanceUpdates() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    monthName: '',
    summary: {
      totalMaintenanceHours: 0,
      totalSessions: 0,
      averageDuration: 0
    },
    craneData: []
  });
  
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  // ✅ Generate month options (last 12 months)
  const generateMonthOptions = () => {
    const months = [];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthValue = date.getMonth();
      const yearValue = date.getFullYear();
      const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      
      months.push({
        value: `${monthValue}-${yearValue}`,
        label: monthName,
        month: monthValue,
        year: yearValue
      });
    }
    
    return months;
  };

  const monthOptions = generateMonthOptions();

  // ✅ Fetch maintenance updates
  const fetchMaintenanceUpdates = async (month, year) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {};
      if (month !== undefined && year !== undefined) {
        params.month = month;
        params.year = year;
      }
      
      const response = await axios.get('/api/crane/maintenance-updates', { 
        params,
        withCredentials: true 
      });
      
      setData(response.data);
    } catch (err) {
      console.error('❌ Failed to fetch maintenance updates:', err);
      setError('Failed to load maintenance data');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle month selection change
  const handleMonthChange = (event) => {
    const [month, year] = event.target.value.split('-').map(Number);
    setSelectedMonth(month);
    setSelectedYear(year);
    fetchMaintenanceUpdates(month, year);
  };

  // ✅ Load default data (current month)
  useEffect(() => {
    fetchMaintenanceUpdates();
  }, []);

  if (error) {
    return (
      <Card className="border-0 shadow-sm">
        <Card.Header className="py-2 bg-white border-bottom">
          <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
            Maintenance Updates
          </h6>
        </Card.Header>
        <Card.Body className="p-2">
          <div className="text-center text-danger" style={{ fontSize: '0.65rem' }}>
            {error}
          </div>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <Card.Header className="py-2 bg-white border-bottom">
        <Row className="align-items-center">
          <Col>
            <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
              Maintenance Updates
            </h6>
          </Col>
          <Col xs="auto">
            <Form.Select 
              size="sm" 
              style={{ fontSize: '0.6rem', width: 'auto' }}
              value={selectedMonth !== '' ? `${selectedMonth}-${selectedYear}` : ''}
              onChange={handleMonthChange}
            >
              <option value="">Auto (Current)</option>
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Select>
          </Col>
        </Row>
      </Card.Header>
      <Card.Body className="p-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {loading ? (
          <div className="text-center" style={{ fontSize: '0.65rem' }}>
            Loading...
          </div>
        ) : data.craneData.length === 0 ? (
          <div className="text-center" style={{ fontSize: '0.65rem', color: '#6c757d' }}>
            No maintenance data for {data.monthName}
          </div>
        ) : (
          <div>
            {/* Month Summary */}
            <div className="text-center mb-2">
              <span className="fw-bold" style={{ fontSize: '0.7rem', color: '#6c757d' }}>
                {data.monthName} Summary
              </span>
            </div>
            
            {/* Summary Stats */}
            <div className="mb-3 p-2" style={{ backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div className="d-flex justify-content-between mb-1">
                <span style={{ fontSize: '0.6rem' }}>Total Hours:</span>
                <span className="fw-bold" style={{ fontSize: '0.6rem', color: '#dc3545' }}>
                  {formatHoursToHoursMinutes(data.summary.totalMaintenanceHours)}
                </span>
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span style={{ fontSize: '0.6rem' }}>Sessions:</span>
                <span className="fw-bold" style={{ fontSize: '0.6rem', color: '#6c757d' }}>
                  {data.summary.totalSessions}
                </span>
              </div>
              <div className="d-flex justify-content-between">
                <span style={{ fontSize: '0.6rem' }}>Avg Duration:</span>
                <span className="fw-bold" style={{ fontSize: '0.6rem', color: '#6c757d' }}>
                  {formatHoursToHoursMinutes(data.summary.averageDuration)}
                </span>
              </div>
            </div>
            
            {/* Individual Crane Data */}
            {data.craneData.map((crane, index) => (
              <div key={crane.craneId} className="mb-3">
                {/* Crane Header */}
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold" style={{ fontSize: '0.7rem', color: '#495057' }}>
                    {crane.craneId}
                  </span>
                  <Badge bg="warning" style={{ fontSize: '0.5rem' }}>
                    {crane.sessions} session{crane.sessions !== 1 ? 's' : ''}
                  </Badge>
                </div>
                
                {/* Crane Summary */}
                <div className="mb-2 p-2" style={{ backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeaa7' }}>
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontSize: '0.6rem' }}>Total:</span>
                    <span className="fw-bold" style={{ fontSize: '0.6rem', color: '#856404' }}>
                      {formatHoursToHoursMinutes(crane.totalHours)}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span style={{ fontSize: '0.6rem' }}>Average:</span>
                    <span className="fw-bold" style={{ fontSize: '0.6rem', color: '#856404' }}>
                      {formatHoursToHoursMinutes(crane.averageDuration)}
                    </span>
                  </div>
                </div>
                
                {/* Maintenance Sessions */}
                <div style={{ fontSize: '0.55rem' }}>
                  {crane.maintenanceSessions.map((session, sessionIndex) => (
                    <div key={sessionIndex} className="mb-1 p-1" style={{ backgroundColor: '#f8f9fa', borderRadius: '3px' }}>
                      <div className="d-flex justify-content-between">
                        <span style={{ color: '#6c757d' }}>
                          📅 {formatTimestamp(session.startTime)}
                        </span>
                        <span className="fw-bold" style={{ color: '#dc3545' }}>
                          {formatHoursToHoursMinutes(session.duration)}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span style={{ color: '#6c757d' }}>
                          {session.isOngoing ? '🔄 Ongoing' : `⏹️ ${formatTimestamp(session.endTime)}`}
                        </span>
                        {session.isOngoing && (
                          <Badge bg="danger" style={{ fontSize: '0.45rem' }}>
                            Active
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Separator */}
                {index < data.craneData.length - 1 && (
                  <hr className="my-2" style={{ borderColor: '#dee2e6', margin: '8px 0' }} />
                )}
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
} 