import React, { useState, useEffect } from 'react';
import { Card, Form, Row, Col } from 'react-bootstrap';
import axios from 'axios';

// ✅ Helper function to convert decimal hours to hours.minutes format
function formatHoursToHoursMinutes(decimalHours) {
  if (!decimalHours || decimalHours === 0) return '0.00';
  
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours % 1) * 60);
  
  // Handle edge case where minutes round to 60
  if (minutes === 60) {
    return `${hours + 1}.00`;
  }
  
  // Format minutes with leading zero if needed
  const formattedMinutes = minutes.toString().padStart(2, '0');
  return `${hours}.${formattedMinutes}`;
}

// ✅ Helper function to get color based on utilization rate
function getUtilizationColor(rate) {
  if (rate >= 70) return '#28a745'; // Green for high utilization
  if (rate >= 50) return '#ffc107'; // Yellow for medium utilization
  return '#dc3545'; // Red for low utilization
}

export default function PreviousMonthStats() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    monthName: '',
    workingHours: 0,
    maintenanceHours: 0,
    idleHours: 0,
    utilizationRate: 0,
    totalHours: 0
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

  // ✅ Fetch previous month stats
  const fetchPreviousMonthStats = async (month, year) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = {};
      if (month !== undefined && year !== undefined) {
        params.month = month;
        params.year = year;
      }
      
      const response = await axios.get('/api/crane/previous-month-stats', { 
        params,
        withCredentials: true 
      });
      
      setStats(response.data);
    } catch (err) {
      console.error('❌ Failed to fetch previous month stats:', err);
      setError('Failed to load previous month data');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle month selection change
  const handleMonthChange = (event) => {
    const [month, year] = event.target.value.split('-').map(Number);
    setSelectedMonth(month);
    setSelectedYear(year);
    fetchPreviousMonthStats(month, year);
  };

  // ✅ Load default data (previous month)
  useEffect(() => {
    fetchPreviousMonthStats();
  }, []);

  if (error) {
    return (
      <Card className="border-0 shadow-sm">
        <Card.Header className="py-2 bg-white border-bottom">
          <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
            Previous Month Performance
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
              Previous Month Performance
            </h6>
          </Col>
          <Col xs="auto">
            <Form.Select 
              size="sm" 
              style={{ fontSize: '0.6rem', width: 'auto' }}
              value={selectedMonth !== '' ? `${selectedMonth}-${selectedYear}` : ''}
              onChange={handleMonthChange}
            >
              <option value="">Auto (Previous)</option>
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Select>
          </Col>
        </Row>
      </Card.Header>
      <Card.Body className="p-2">
        {loading ? (
          <div className="text-center" style={{ fontSize: '0.65rem' }}>
            Loading...
          </div>
        ) : (
          <div>
            {/* Month Name */}
            <div className="text-center mb-2">
              <span className="fw-bold" style={{ fontSize: '0.7rem', color: '#6c757d' }}>
                {stats.monthName}
              </span>
            </div>
            
            {/* Working Hours */}
            <div className="d-flex justify-content-between mb-1">
              <span style={{ fontSize: '0.6rem' }}>Working Hours:</span>
              <span className="fw-bold" style={{ fontSize: '0.6rem', color: '#28a745' }}>
                {formatHoursToHoursMinutes(stats.workingHours)}h
              </span>
            </div>
            
            {/* Maintenance Hours */}
            <div className="d-flex justify-content-between mb-1">
              <span style={{ fontSize: '0.6rem' }}>Maintenance:</span>
              <span className="fw-bold" style={{ fontSize: '0.6rem', color: '#ffc107' }}>
                {formatHoursToHoursMinutes(stats.maintenanceHours)}h
              </span>
            </div>
            
            {/* Idle Hours */}
            <div className="d-flex justify-content-between mb-1">
              <span style={{ fontSize: '0.6rem' }}>Idle Time:</span>
              <span className="fw-bold" style={{ fontSize: '0.6rem', color: '#dc3545' }}>
                {formatHoursToHoursMinutes(stats.idleHours)}h
              </span>
            </div>
            
            {/* Utilization Rate */}
            <div className="d-flex justify-content-between mb-1">
              <span style={{ fontSize: '0.6rem' }}>Utilization:</span>
              <span 
                className="fw-bold" 
                style={{ 
                  fontSize: '0.6rem', 
                  color: getUtilizationColor(stats.utilizationRate) 
                }}
              >
                {stats.utilizationRate.toFixed(1)}%
              </span>
            </div>
            
            {/* Total Hours */}
            <div className="d-flex justify-content-between">
              <span style={{ fontSize: '0.6rem' }}>Total Hours:</span>
              <span className="fw-bold" style={{ fontSize: '0.6rem', color: '#6c757d' }}>
                {formatHoursToHoursMinutes(stats.totalHours)}h
              </span>
            </div>
            
            {/* Revenue Impact Estimate */}
            {stats.idleHours > 0 && (
              <div className="mt-2 pt-1 border-top">
                <div className="d-flex justify-content-between">
                  <span style={{ fontSize: '0.55rem', color: '#dc3545' }}>Revenue Loss:</span>
                  <span className="fw-bold" style={{ fontSize: '0.55rem', color: '#dc3545' }}>
                    ~₹{(stats.idleHours * 50).toLocaleString()}
                  </span>
                </div>
                <small style={{ fontSize: '0.5rem', color: '#6c757d' }}>
                  (Est. ₹50/hour rental rate)
                </small>
              </div>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
} 