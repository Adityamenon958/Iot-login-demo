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

const ElevatorLineChart = ({ selectedElevator, timeRange, visibleLines = { working: true, maintenance: true, error: true } }) => {
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

        // Calculate date range based on timeRange (using UTC consistently)
        const now = new Date();
        const hoursAgo = parseInt(timeRange) || 24;
        const start = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

        const response = await axios.get('/api/elevator/timeseries-stats', {
          withCredentials: true,
          params: {
            elevatorId: selectedElevator,
            start: start.toISOString(), // UTC format
            end: now.toISOString(),     // UTC format
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
          } else if (point.date.includes('Week of')) {
            // Weekly format from backend: "Week of Oct 06" - convert to date range
            const weekMatch = point.date.match(/Week of (\w+) (\d+)/);
            if (weekMatch) {
              const [, monthStr, dayStr] = weekMatch;
              const monthMap = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
              };
              const month = monthMap[monthStr];
              const day = parseInt(dayStr);
              const currentYear = new Date().getFullYear();
              
              const weekStart = new Date(currentYear, month, day);
              const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000); // +6 days
              
              // Cap the week end to not exceed current date
              const currentDate = new Date();
              const cappedWeekEnd = new Date(Math.min(weekEnd.getTime(), currentDate.getTime()));
              
              // Format as date range
              const startStr = weekStart.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              });
              const endStr = cappedWeekEnd.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              });
              
              // If the week end is the same as start (partial week), just show the start date
              if (weekStart.toDateString() === cappedWeekEnd.toDateString()) {
                return startStr;
              }
              
              return `${startStr} - ${endStr}`;
            }
            return point.date; // Fallback to original string
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

        // ✅ Create all datasets first
        const allDatasets = [
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
        ];

        // ✅ Filter datasets based on visibleLines
        const filteredDatasets = allDatasets.filter(dataset => {
          if (dataset.label === 'Working Hours') return visibleLines.working;
          if (dataset.label === 'Maintenance Hours') return visibleLines.maintenance;
          if (dataset.label === 'Error Hours') return visibleLines.error;
          return true;
        });

        const processedData = {
          labels,
          datasets: filteredDatasets,
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
  }, [selectedElevator, timeRange, visibleLines]);

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
