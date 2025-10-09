import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import axios from 'axios';
import styles from './ElevatorLineChart.module.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ElevatorLineChart = ({ selectedElevator, timeRange }) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Fetch real elevator data
  useEffect(() => {
    const fetchChartData = async () => {
      if (!selectedElevator) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Calculate date range based on timeRange
        const now = new Date();
        const hoursAgo = parseInt(timeRange) || 24;
        const start = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

        const response = await axios.get('/api/elevator/timeseries-stats', {
          withCredentials: true,
          params: {
            elevatorId: selectedElevator,
            start: start.toISOString(),
            end: now.toISOString(),
            granularity: 'auto'
          }
        });

        const apiData = response.data.points || [];
        
        if (apiData.length === 0) {
          setError('No data available for the selected time range');
          setChartData(null);
          return;
        }

        // Process API data for Chart.js
        const labels = apiData.map(point => {
          // Handle different date formats from API
          let date;
          if (point.date.includes('T') || point.date.includes(' ')) {
            // Full datetime format
            date = new Date(point.date);
          } else if (point.date.includes('-W')) {
            // Weekly format (2025-W4) - convert to date range
            const [year, weekStr] = point.date.split('-W');
            const week = parseInt(weekStr);
            
            // Calculate the start of the week (Monday)
            const jan1 = new Date(year, 0, 1);
            const jan1Day = jan1.getDay();
            const daysToFirstMonday = jan1Day === 0 ? 1 : 8 - jan1Day; // Adjust for Monday start
            const firstMonday = new Date(jan1.getTime() + daysToFirstMonday * 24 * 60 * 60 * 1000);
            
            // Calculate the start of the specified week
            const weekStart = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
            const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000); // +6 days
            
            // Format as date range
            const startStr = weekStart.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            });
            const endStr = weekEnd.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            });
            
            return `${startStr} - ${endStr}`;
          } else if (point.date.includes('-')) {
            // Date-only format (YYYY-MM-DD) - add time to make it valid
            date = new Date(point.date + 'T00:00:00');
          } else {
            // Fallback
            date = new Date(point.date);
          }
          
          // Check if date is valid
          if (isNaN(date.getTime())) {
            return point.date; // Return original string if parsing fails
          }
          
          // Format based on granularity
          const granularity = response.data.granularity || 'daily';
          if (granularity === 'hourly') {
            return date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
          } else {
            return date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            });
          }
        });

        const processedData = {
          labels,
          datasets: [
            {
              label: 'Working Hours',
              data: apiData.map(point => point.workingHours || 0),
              borderColor: '#28a745',
              backgroundColor: 'rgba(40, 167, 69, 0.1)',
              borderWidth: 2,
              fill: false,
              tension: 0.4,
              pointBackgroundColor: '#28a745',
              pointBorderColor: '#28a745',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
            },
            {
              label: 'Maintenance Hours',
              data: apiData.map(point => point.maintenanceHours || 0),
              borderColor: '#ffc107',
              backgroundColor: 'rgba(255, 193, 7, 0.1)',
              borderWidth: 2,
              fill: false,
              tension: 0.4,
              pointBackgroundColor: '#ffc107',
              pointBorderColor: '#ffc107',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
            },
            {
              label: 'Error Hours',
              data: apiData.map(point => point.errorHours || 0),
              borderColor: '#dc3545',
              backgroundColor: 'rgba(220, 53, 69, 0.1)',
              borderWidth: 2,
              fill: false,
              tension: 0.4,
              pointBackgroundColor: '#dc3545',
              pointBorderColor: '#dc3545',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
            }
          ]
        };

        setChartData(processedData);
      } catch (err) {
        console.error('Error fetching chart data:', err);
        setError('Failed to load chart data');
        setChartData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [selectedElevator, timeRange]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false  // Remove legend to save space
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#4facfe',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        padding: 12,
        callbacks: {
          title: function(context) {
            return context[0].label;
          },
          label: function(context) {
            const value = context.parsed.y;
            let formattedValue;
            
            if (value === 0) {
              formattedValue = '0h';
            } else {
              const hours = Math.floor(value);
              const minutes = Math.round((value - hours) * 60);
              
              if (hours === 0 && minutes === 0) {
                formattedValue = '0h';
              } else if (hours === 0) {
                formattedValue = `${minutes}m`;
              } else if (minutes === 0) {
                formattedValue = `${hours}h`;
              } else {
                formattedValue = `${hours}h ${minutes}m`;
              }
            }
            
            return `${context.dataset.label}: ${formattedValue}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { 
          color: 'rgba(0, 0, 0, 0.1)',
          drawBorder: false
        },
        ticks: { 
          color: '#666',
          font: { size: 10 }
        }
      },
      y: {
        grid: { 
          color: 'rgba(0, 0, 0, 0.1)',
          drawBorder: false
        },
        ticks: { 
          color: '#666',
          font: { size: 10 },
          callback: function(value) {
            // Convert decimal hours to "Xh Ym" format
            if (value === 0) return '0h';
            
            const hours = Math.floor(value);
            const minutes = Math.round((value - hours) * 60);
            
            if (hours === 0 && minutes === 0) return '0h';
            if (hours === 0) return `${minutes}m`;
            if (minutes === 0) return `${hours}h`;
            return `${hours}h ${minutes}m`;
          }
        },
        min: 0
      }
    },
    animation: {
      duration: 1500,
      easing: 'easeInOutQuart'
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  // Handle different states
  if (loading) {
    return (
      <div className={styles.chartContainer}>
        <div className={styles.chartWrapper} style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#666',
          fontSize: '0.9rem'
        }}>
          Loading chart data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.chartContainer}>
        <div className={styles.chartWrapper} style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#dc3545',
          fontSize: '0.9rem',
          textAlign: 'center'
        }}>
          {error}
        </div>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className={styles.chartContainer}>
        <div className={styles.chartWrapper} style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#666',
          fontSize: '0.9rem'
        }}>
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chartContainer}>
      <div className={styles.chartWrapper}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};

export default ElevatorLineChart;
