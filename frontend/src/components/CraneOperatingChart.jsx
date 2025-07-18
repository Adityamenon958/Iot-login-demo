import React, { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import { Form, Spinner } from 'react-bootstrap';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// ✅ Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function CraneOperatingChart({ deviceId }) {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('24hr');

  // ✅ Fetch chart data when device or period changes
  useEffect(() => {
    if (!deviceId || deviceId === "No Data") return;

    const fetchChartData = async () => {
      try {
        setLoading(true);
        const res = await axios.get("/api/crane/chart", {
          params: { deviceId, period },
          withCredentials: true,
        });
        setChartData(res.data);
      } catch (err) {
        console.error("Chart fetch error", err);
        setChartData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [deviceId, period]);

  // ✅ Chart configuration
  const chartConfig = {
    data: {
      labels: chartData?.labels || [],
      datasets: [
        {
          label: 'Operating Hours',
          data: chartData?.data || [],
          backgroundColor: 'rgba(54, 162, 235, 0.8)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Hours',
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
          },
        },
        x: {
          title: {
            display: true,
            text: getPeriodLabel(period),
          },
          grid: {
            display: false,
          },
        },
      },
    },
  };

  // ✅ Get period label for x-axis
  function getPeriodLabel(period) {
    switch (period) {
      case '24hr': return 'Hour';
      case 'weekly': return 'Day';
      case 'monthly': return 'Date';
      case 'yearly': return 'Month';
      default: return 'Time';
    }
  }

  // ✅ Get period display name
  function getPeriodDisplayName(period) {
    switch (period) {
      case '24hr': return 'Last 24 Hours';
      case 'weekly': return 'Last 7 Days';
      case 'monthly': return 'Last 30 Days';
      case 'yearly': return 'Last 12 Months';
      default: return 'Unknown Period';
    }
  }

  return (
    <div>
      {/* ✅ Period Selection Dropdown */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold mb-0">Operating Hours Chart</h6>
        <Form.Select
          size="sm"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          style={{ width: '150px' }}
        >
          <option value="24hr">Last 24 Hours</option>
          <option value="weekly">Last 7 Days</option>
          <option value="monthly">Last 30 Days</option>
          <option value="yearly">Last 12 Months</option>
        </Form.Select>
      </div>

      {/* ✅ Chart Container */}
      <div style={{ height: '200px' }}>
        {loading ? (
          <div className="d-flex justify-content-center align-items-center h-100">
            <Spinner animation="border" />
          </div>
        ) : chartData && chartData.labels.length > 0 ? (
          <Bar {...chartConfig} />
        ) : (
          <div className="d-flex justify-content-center align-items-center h-100 text-muted">
            <div className="text-center">
              <div className="mb-2">📊</div>
              <small>No data available for {getPeriodDisplayName(period)}</small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 