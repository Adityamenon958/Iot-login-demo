import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

export default function CraneBarChart() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState([]);

  // ✅ Fetch individual crane statistics
  useEffect(() => {
    const fetchCraneStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await axios.get('/api/crane/crane-stats', { 
          withCredentials: true 
        });
        
        setChartData(response.data.craneData || []);
      } catch (err) {
        console.error('❌ Failed to fetch crane stats:', err);
        setError('Failed to load chart data');
      } finally {
        setLoading(false);
      }
    };

    fetchCraneStats();
  }, []);

  // ✅ Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: '0 0 4px 0', fontWeight: 'bold' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ 
              margin: '2px 0', 
              color: entry.color,
              fontSize: '12px'
            }}>
              {entry.name}: {formatHoursToHoursMinutes(entry.value)}
              {entry.dataKey === 'inactiveHours' && ' (Right Scale)'}
              {(entry.dataKey === 'workingHours' || entry.dataKey === 'maintenanceHours') && ' (Left Scale)'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // ✅ Loading state
  if (loading) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8f9fa'
      }}>
        <p className="text-muted" style={{ fontSize: '0.65rem' }}>
          Loading chart data...
        </p>
      </div>
    );
  }

  // ✅ Error state
  if (error) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8f9fa'
      }}>
        <p className="text-muted" style={{ fontSize: '0.65rem' }}>
          {error}
        </p>
      </div>
    );
  }

  // ✅ No data state
  if (chartData.length === 0) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8f9fa'
      }}>
        <p className="text-muted" style={{ fontSize: '0.65rem' }}>
          No crane data available
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis 
          dataKey="craneId" 
          stroke="#666"
          fontSize={10}
          tick={{ fontSize: 10 }}
        />
        {/* Left Y-axis for Working & Maintenance Hours (0-50h range) */}
        <YAxis 
          yAxisId="left"
          orientation="left"
          stroke="#666"
          fontSize={10}
          tick={{ fontSize: 10 }}
          tickFormatter={(value) => formatHoursToHoursMinutes(value)}
          domain={[0, 50]}
        />
        {/* Right Y-axis for Inactive Hours (0-5000h range) */}
        <YAxis 
          yAxisId="right"
          orientation="right"
          stroke="#666"
          fontSize={10}
          tick={{ fontSize: 10 }}
          tickFormatter={(value) => formatHoursToHoursMinutes(value)}
          domain={[0, 5000]}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          wrapperStyle={{ fontSize: '10px' }}
          iconType="rect"
        />
        {/* Working Hours Bar - Uses Left Y-axis */}
        <Bar 
          dataKey="workingHours" 
          fill="#2563eb" 
          name="Working Hours"
          yAxisId="left"
          radius={[2, 2, 0, 0]}
        />
        {/* Maintenance Hours Bar - Uses Left Y-axis */}
        <Bar 
          dataKey="maintenanceHours" 
          fill="#f97316" 
          name="Maintenance Hours"
          yAxisId="left"
          radius={[2, 2, 0, 0]}
        />
        {/* Inactive Hours Bar - Uses Right Y-axis */}
        <Bar 
          dataKey="inactiveHours" 
          fill="#9ca3af" 
          name="Inactive Hours"
          yAxisId="right"
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
} 