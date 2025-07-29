import React, { useState, useEffect } from 'react';
import { Col, Row, Card } from 'react-bootstrap';
import styles from "./MainContent.module.css";
// ✅ Import icons from react-icons
import { PiCraneDuotone, PiTimerDuotone, PiBandaidsFill } from "react-icons/pi";
import { GiNightSleep } from "react-icons/gi";
import axios from 'axios';
// ✅ Import MonthlyChart component
import MonthlyChart from '../components/MonthlyChart';
// ✅ Import CraneBarChart component
import CraneBarChart from '../components/CraneBarChart';
// ✅ Import PreviousMonthStats component
import PreviousMonthStats from '../components/PreviousMonthStats';
// ✅ Import MaintenanceUpdates component
import MaintenanceUpdates from '../components/MaintenanceUpdates';
import CraneDistanceChart from '../components/CraneDistanceChart';
import CraneDetails from '../components/CraneDetails';
import ExportModal from '../components/ExportModal';

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

export default function CraneOverview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCrane, setSelectedCrane] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    totalWorkingHours: 0,
    completedHours: 0,
    ongoingHours: 0,
    activeCranes: 0,
    inactiveCranes: 0,
    underMaintenance: 0,
          quickStats: {
        today: { completed: 0, ongoing: 0, total: 0 },
        thisWeek: { completed: 0, ongoing: 0, total: 0 },
        thisMonth: { completed: 0, ongoing: 0, total: 0 },
        thisYear: { completed: 0, ongoing: 0, total: 0 }
      }
  });

  // ✅ Fetch crane overview data from backend
  useEffect(() => {
    const fetchCraneOverview = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await axios.get('/api/crane/overview', { 
          withCredentials: true 
        });
        
        setDashboardData(response.data);
      } catch (err) {
        console.error('❌ Failed to fetch crane overview:', err);
        setError('Failed to load crane data');
      } finally {
        setLoading(false);
      }
    };

    fetchCraneOverview();
  }, []);

  // ✅ Handler for crane selection
  const handleCraneSelect = (craneData) => {
    setSelectedCrane(craneData);
  };

  // ✅ Handler for export modal
  const handleExportModal = () => {
    setShowExportModal(true);
  };

  // ✅ Define card data for better maintainability
  const summaryCards = [
    {
      id: 1,
      title: `Total Working Hours (${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()})`,
      value: dashboardData.quickStats?.thisMonth?.completed || 0,  // ✅ Use current month's completed hours
      ongoingHours: dashboardData.quickStats?.thisMonth?.ongoing || 0,  // ✅ Use current month's ongoing hours
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      icon: PiTimerDuotone,
      iconSize: 60
    },
    {
      id: 2,
      title: "Active Cranes",
      value: dashboardData.activeCranes,
      gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      icon: PiCraneDuotone,
      iconSize: 60
    },
    {
      id: 3,
      title: "Inactive Cranes",
      value: dashboardData.inactiveCranes,
      gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
      icon: GiNightSleep,
      iconSize: 60
    },
    {
      id: 4,
      title: "Under Maintenance",
      value: dashboardData.underMaintenance,
      gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
      icon: PiBandaidsFill,
      iconSize: 60
    }
  ];

  // ✅ Render summary card component
  const renderSummaryCard = (card) => {
    const IconComponent = card.icon;
    
    // ✅ Special display for working hours with ongoing indicator
    let displayValue;
    if (card.id === 1) {
      // ✅ First card: Working Hours - show time format
      if (card.ongoingHours > 0) {
        displayValue = `${formatHoursToHoursMinutes(Math.max(0, card.value))} + ${formatHoursToHoursMinutes(card.ongoingHours)} ongoing`;
      } else {
        displayValue = formatHoursToHoursMinutes(Math.max(0, card.value));
      }
    } else {
      // ✅ Other cards: Active/Inactive/Maintenance - show just the number
      displayValue = Math.max(0, card.value).toString();
    }
  
    return (
      <Col xs={6} sm={6} md={3} className="mb-2" key={card.id}>
        <Card 
          className="h-100 border-0 shadow-sm" 
          style={{ 
            background: card.gradient,
            minHeight: '120px'
          }}
        >
          <Card.Body className="p-3 text-white position-relative">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <h3 className="mb-1 fw-bold" style={{ fontSize: '1.8rem' }}>
                  {loading ? '...' : displayValue}
                </h3>
                <p className="mb-0" style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                  {card.title}
                </p>
              </div>
              <div style={{ opacity: 0.8 }}>
                <IconComponent size={card.iconSize} />
              </div>
            </div>
          </Card.Body>
        </Card>
      </Col>
    );
  };

  // ✅ Show loading state
  if (loading) {
    return (
      <Col xs={12} md={9} lg={10} xl={10} className={`${styles.mainCO} p-3`}>
        <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="text-muted">Loading crane overview data...</p>
          </div>
        </div>
      </Col>
    );
  }

  // ✅ Show error state
  if (error) {
    return (
      <Col xs={12} md={9} lg={10} xl={10} className={`${styles.mainCO} p-3`}>
        <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
          <div className="text-center">
            <div className="text-danger mb-3">
              <i className="fas fa-exclamation-triangle fa-2x"></i>
            </div>
            <p className="text-danger">{error}</p>
            <button 
              className="btn btn-outline-primary btn-sm"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </Col>
    );
  }

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={`${styles.mainCO} p-3`}>
      {/* ✅ Section 1: Header */}
      <div className="mb-2 d-flex justify-content-between align-items-center">
        <div>
          <h6 className="mb-0">Crane Overview Dashboard</h6>
          <p className="text-muted mb-0" style={{ fontSize: '0.65rem' }}>
            Overview of all crane operations and status
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleExportModal}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '0.8rem',
            fontWeight: '500',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
          }}
        >
          📊 Export Report
        </button>
      </div>

      {/* ✅ Section 2: Top Row - 4 Summary Cards */}
      <Row className="mb-3">
        {summaryCards.map(card => renderSummaryCard(card))}
      </Row>

      {/* ✅ Section 3: Middle Section - Two Columns */}
      <Row>
        {/* Left Column - Chart */}
        <Col xs={12} lg={7} className="mb-2">
          <Card className="h-100 border-0 shadow-sm">
            <Card.Header className="py-2 bg-white border-bottom">
              <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
                Crane Activity Trend
              </h6>
            </Card.Header>
            <Card.Body className="p-2" style={{ padding: '8px !important', minHeight: '400px' }}>
              {/* Upper Half - Line Chart Section */}
              <div 
                style={{ 
                  height: '50%',
                  backgroundColor: '#f8f9fa',
                  borderBottom: '1px solid #dee2e6',
                  marginBottom: '4px',
                  minHeight: '180px'
                }}
              >
                <MonthlyChart />
              </div>
              
              {/* Lower Half - Bar Chart Section */}
              <div 
                style={{ 
                  height: '50%',
                  backgroundColor: '#f8f9fa',
                  minHeight: '180px'
                }}
              >
                <CraneBarChart />
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Right Column - Messages & Stats */}
        <Col xs={12} lg={5} className="mb-2">
          <Row>
            {/* Quick Stats */}
            <Col xs={12} className="mb-2">
              <Card className="border-0 shadow-sm">
                <Card.Header className="py-2 bg-white border-bottom">
                  <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
                    Quick Statistics
                  </h6>
                </Card.Header>
                <Card.Body className="p-2">
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontSize: '0.6rem' }}>Today:</span>
                    <span className="fw-bold" style={{ fontSize: '0.6rem' }}>
                      {loading ? '...' : formatHoursToHoursMinutes(dashboardData.quickStats?.today?.completed || 0)}
                      {!loading && dashboardData.quickStats?.today?.ongoing > 0 && ` + ${formatHoursToHoursMinutes(dashboardData.quickStats.today.ongoing)} ongoing`}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontSize: '0.6rem' }}>This Week:</span>
                    <span className="fw-bold" style={{ fontSize: '0.6rem' }}>
                      {loading ? '...' : formatHoursToHoursMinutes(dashboardData.quickStats?.thisWeek?.completed || 0)}
                      {!loading && dashboardData.quickStats?.thisWeek?.ongoing > 0 && ` + ${formatHoursToHoursMinutes(dashboardData.quickStats.thisWeek.ongoing)} ongoing`}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontSize: '0.6rem' }}>This Month:</span>
                    <span className="fw-bold" style={{ fontSize: '0.6rem' }}>
                      {loading ? '...' : formatHoursToHoursMinutes(dashboardData.quickStats?.thisMonth?.completed || 0)}
                      {!loading && dashboardData.quickStats?.thisMonth?.ongoing > 0 && ` + ${formatHoursToHoursMinutes(dashboardData.quickStats.thisMonth.ongoing)} ongoing`}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span style={{ fontSize: '0.6rem' }}>This Year:</span>
                    <span className="fw-bold" style={{ fontSize: '0.6rem' }}>
                      {loading ? '...' : formatHoursToHoursMinutes(dashboardData.quickStats?.thisYear?.completed || 0)}
                      {!loading && dashboardData.quickStats?.thisYear?.ongoing > 0 && ` + ${formatHoursToHoursMinutes(dashboardData.quickStats.thisYear.ongoing)} ongoing`}
                    </span>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Previous Month Performance */}
            <Col xs={12} className="mb-2">
              <PreviousMonthStats />
            </Col>

            {/* Maintenance Updates */}
            <Col xs={12}>
              <MaintenanceUpdates />
            </Col>
          </Row>
        </Col>
      </Row>

      {/* ✅ Section 4: Movement Tracking - Full Row with Two Columns */}
      <Row className="mt-4">
        {/* Left Column - Distance Chart */}
        <Col xs={12} lg={7} className="mb-3">
          <CraneDistanceChart onCraneSelect={handleCraneSelect} />
        </Col>
        
        {/* Right Column - Crane Details */}
        <Col xs={12} lg={5} className="mb-3">
          <CraneDetails selectedCrane={selectedCrane} />
        </Col>
      </Row>

      {/* ✅ Export Modal */}
      <ExportModal 
        show={showExportModal}
        onHide={() => setShowExportModal(false)}
        companyName="Gsn Soln"
      />
    </Col>
  );
}