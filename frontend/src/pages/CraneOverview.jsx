import React, { useState, useEffect } from 'react';
import { Col, Row, Card } from 'react-bootstrap';
import styles from "./MainContent.module.css";
// ✅ Import icons from react-icons
import { PiCraneDuotone, PiTimerDuotone, PiBandaidsFill } from "react-icons/pi";
import { GiNightSleep } from "react-icons/gi";
import axios from 'axios';

export default function CraneOverview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    totalWorkingHours: 0,
    activeCranes: 0,
    inactiveCranes: 0,
    underMaintenance: 0,
    quickStats: {
      todayOperations: 0,
      thisWeekOperations: 0,
      thisMonthOperations: 0
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

  // ✅ Define card data for better maintainability
  const summaryCards = [
    {
      id: 1,
      title: "Total Working Hours",
      value: dashboardData.totalWorkingHours,
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
                  {loading ? '...' : card.value}
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
      <div className="mb-2">
        <h6 className="mb-0">Crane Overview Dashboard</h6>
        <p className="text-muted mb-0" style={{ fontSize: '0.65rem' }}>
          Overview of all crane operations and status
        </p>
      </div>

      {/* ✅ Section 2: Top Row - 4 Summary Cards */}
      <Row className="mb-2">
        {summaryCards.map(renderSummaryCard)}
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
            <Card.Body className="p-2">
              <div 
                style={{ 
                  height: '150px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  backgroundColor: '#f8f9fa' 
                }}
              >
                <p className="text-muted" style={{ fontSize: '0.65rem' }}>
                  Chart will be placed here
                </p>
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
                    <span style={{ fontSize: '0.6rem' }}>Today's Operations:</span>
                    <span className="fw-bold" style={{ fontSize: '0.6rem' }}>
                      {dashboardData.quickStats.todayOperations}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontSize: '0.6rem' }}>This Week:</span>
                    <span className="fw-bold" style={{ fontSize: '0.6rem' }}>
                      {dashboardData.quickStats.thisWeekOperations}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span style={{ fontSize: '0.6rem' }}>This Month:</span>
                    <span className="fw-bold" style={{ fontSize: '0.6rem' }}>
                      {dashboardData.quickStats.thisMonthOperations}
                    </span>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Recent Alerts */}
            <Col xs={12} className="mb-2">
              <Card className="border-0 shadow-sm">
                <Card.Header className="py-2 bg-white border-bottom">
                  <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
                    Recent Alerts
                  </h6>
                </Card.Header>
                <Card.Body className="p-2">
                  <div 
                    style={{ 
                      height: '80px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      backgroundColor: '#f8f9fa' 
                    }}
                  >
                    <p className="text-muted" style={{ fontSize: '0.65rem' }}>
                      Alerts list will be placed here
                    </p>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* System Updates */}
            <Col xs={12}>
              <Card className="border-0 shadow-sm">
                <Card.Header className="py-2 bg-white border-bottom">
                  <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
                    System Updates
                  </h6>
                </Card.Header>
                <Card.Body className="p-2">
                  <div 
                    style={{ 
                      height: '80px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      backgroundColor: '#f8f9fa' 
                    }}
                  >
                    <p className="text-muted" style={{ fontSize: '0.65rem' }}>
                      System updates will be placed here
                    </p>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </Col>
  );
}