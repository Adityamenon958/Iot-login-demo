import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import axios from 'axios';

export default function MonthlyChart() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState([]);

  // ✅ Fetch monthly crane statistics
  useEffect(() => {
    const fetchMonthlyStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await axios.get('/api/crane/monthly-stats', { 
          withCredentials: true 
        });
        
        setChartData(response.data.monthlyData || []);
      } catch (err) {
        console.error('❌ Failed to fetch monthly stats:', err);
        setError('Failed to load chart data');
      } finally {
        setLoading(false);
      }
    };

    fetchMonthlyStats();
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
              {entry.name}: {entry.value}h
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
          No data available
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        <XAxis 
          dataKey="month" 
          stroke="#666"
          fontSize={10}
          tick={{ fontSize: 10 }}
        />
        <YAxis 
          stroke="#666"
          fontSize={10}
          tick={{ fontSize: 10 }}
          tickFormatter={(value) => `${value}h`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          wrapperStyle={{ fontSize: '10px' }}
          iconType="line"
        />
        <Line 
          type="monotone" 
          dataKey="usageHours" 
          stroke="#2563eb" 
          strokeWidth={2}
          dot={{ fill: '#2563eb', strokeWidth: 2, r: 3 }}
          activeDot={{ r: 5, stroke: '#2563eb', strokeWidth: 2 }}
          name="Usage Hours"
        />
        <Line 
          type="monotone" 
          dataKey="maintenanceHours" 
          stroke="#f97316" 
          strokeWidth={2}
          dot={{ fill: '#f97316', strokeWidth: 2, r: 3 }}
          activeDot={{ r: 5, stroke: '#f97316', strokeWidth: 2 }}
          name="Maintenance Hours"
        />
      </LineChart>
    </ResponsiveContainer>
  );
} 