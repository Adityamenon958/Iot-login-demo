import React, { useState, useEffect } from 'react';
import { Form, Row, Col } from 'react-bootstrap';
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

// ✅ Helper function to get color based on utilization rate
function getUtilizationColor(rate) {
  if (rate >= 70) return '#28a745'; // Green for high utilization
  if (rate >= 50) return '#ffc107'; // Yellow for medium utilization
  return '#dc3545'; // Red for low utilization
}

export default function PreviousMonthStatsContent({ selectedMonth, selectedYear }) {
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
      
      console.log('🔍 Previous Month Stats API Response:', response.data);
      console.log('🔍 Month Name from API:', response.data.monthName);
      
      setStats(response.data);
    } catch (err) {
      console.error('❌ Failed to fetch previous month stats:', err);
      setError('Failed to load previous month data');
    } finally {
      setLoading(false);
    }
  };



  // ✅ Load default data (previous month) and watch for prop changes
  useEffect(() => {
    // If no month selected, fetch previous month data (default behavior)
    if (selectedMonth === '' && selectedYear === '') {
      fetchPreviousMonthStats(); // This will fetch previous month data
    } else {
      fetchPreviousMonthStats(selectedMonth, selectedYear);
    }
  }, [selectedMonth, selectedYear]);

  if (error) {
    return (
      <div className="text-center text-danger" style={{ fontSize: '0.65rem' }}>
        {error}
      </div>
    );
  }

  return (
    <div>
      {loading ? (
        <div className="text-center" style={{ fontSize: '0.65rem' }}>
          Loading...
        </div>
      ) : (
        <div>
          {/* Month Name */}
          <div className="text-center mb-2">
            <span className="fw-bold" style={{ fontSize: '0.7rem', color: '#6c757d' }}>
              {stats.monthName || 'Loading...'}
            </span>
          </div>
          
          {/* Working Hours */}
          <div className="d-flex justify-content-between mb-1">
            <span style={{ fontSize: '0.6rem' }}>Working Hours:</span>
            <span className="fw-bold" style={{ fontSize: '0.6rem', color: '#28a745' }}>
              {formatHoursToHoursMinutes(stats.workingHours)}
            </span>
          </div>
          
          {/* Maintenance Hours */}
          <div className="d-flex justify-content-between mb-1">
            <span style={{ fontSize: '0.6rem' }}>Maintenance:</span>
            <span className="fw-bold" style={{ fontSize: '0.6rem', color: '#ffc107' }}>
              {formatHoursToHoursMinutes(stats.maintenanceHours)}
            </span>
          </div>
          
          {/* Idle Hours */}
          <div className="d-flex justify-content-between mb-1">
            <span style={{ fontSize: '0.6rem' }}>Idle Time:</span>
            <span className="fw-bold" style={{ fontSize: '0.6rem', color: '#dc3545' }}>
              {formatHoursToHoursMinutes(stats.idleHours)}
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
          <div className="d-flex justify-content-between mb-1">
            <span style={{ fontSize: '0.6rem' }}>Total Hours:</span>
            <span className="fw-bold" style={{ fontSize: '0.6rem', color: '#495057' }}>
              {formatHoursToHoursMinutes(stats.totalHours)}
            </span>
          </div>
          
          {/* Revenue Loss */}
          <div className="d-flex justify-content-between mb-1">
            <span style={{ fontSize: '0.6rem' }}>Revenue Loss:</span>
            <span className="fw-bold" style={{ fontSize: '0.6rem', color: '#dc3545' }}>
              ~₹{Math.round(stats.idleHours * 50).toLocaleString()}
            </span>
          </div>
          
          {/* Rental Rate Note */}
          <div className="text-center mt-2">
            <small className="text-muted" style={{ fontSize: '0.55rem' }}>
              (Est. ₹50/hour rental rate)
            </small>
          </div>
        </div>
      )}
    </div>
  );
} 