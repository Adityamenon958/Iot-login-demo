import React, { useState, useEffect } from 'react';
import { Col, Row, Card, Button } from 'react-bootstrap';
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
// ✅ Import background refresh hook and components
import { useBackgroundRefresh } from '../hooks/useBackgroundRefresh';
import { SmoothValueTransition, SmoothNumberTransition, SmoothTimeTransition } from '../components/SmoothValueTransition';
import { LastUpdatedTimestamp } from '../components/LastUpdatedTimestamp';

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
  const [selectedCrane, setSelectedCrane] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeTab, setActiveTab] = useState('working');

  // ✅ Background refresh hook for dashboard data
  const {
    data: dashboardData,
    lastUpdated,
    error,
    isInitialized,
    manualRefresh
  } = useBackgroundRefresh(
    async () => {
      const response = await axios.get('/api/crane/overview', { 
        withCredentials: true 
      });
      return response.data;
    },
    30000 // 30 seconds refresh interval
  );

  // ✅ Initialize with default data
  const defaultData = {
    totalWorkingHours: 0,
    completedHours: 0,
    ongoingHours: 0,
    activeCranes: 0,
    inactiveCranes: 0,
    underMaintenance: 0,
    quickStats: {
      today: { completed: 0, ongoing: 0, idle: 0, maintenance: 0 },
      thisWeek: { completed: 0, ongoing: 0, idle: 0, maintenance: 0 },
      thisMonth: { completed: 0, ongoing: 0, idle: 0, maintenance: 0 },
      thisYear: { completed: 0, ongoing: 0, idle: 0, maintenance: 0 }
    }
  };

  // ✅ Use dashboard data or default
  const currentData = dashboardData || defaultData;

  // ✅ Handler for crane selection
  const handleCraneSelect = (craneData) => {
    setSelectedCrane(craneData);
  };

  // ✅ Handler for export modal
  const handleExportModal = () => {
    setShowExportModal(true);
  };

  // ✅ Calculate total cranes for fraction display
  const totalCranes = (currentData.activeCranes || 0) + (currentData.inactiveCranes || 0) + (currentData.underMaintenance || 0);

  // ✅ Define card data for better maintainability
  const summaryCards = [
    {
      id: 1,
      title: `Total Working Hours (${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()})`,
      subtitle: `${totalCranes} Total Cranes`,
      value: currentData.quickStats?.thisMonth?.completed || 0,  // ✅ Use current month's completed hours
      ongoingHours: currentData.quickStats?.thisMonth?.ongoing || 0,  // ✅ Use current month's ongoing hours
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      icon: PiTimerDuotone,
      iconSize: 60
    },
    {
      id: 2,
      title: `${currentData.activeCranes || 0}/${totalCranes} Active Cranes`,
      value: currentData.activeCranes,
      gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      icon: PiCraneDuotone,
      iconSize: 60
    },
    {
      id: 3,
      title: `${currentData.inactiveCranes || 0}/${totalCranes} Idle Cranes`,
      value: currentData.inactiveCranes,
      gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
      icon: GiNightSleep,
      iconSize: 60
    },
    {
      id: 4,
      title: `${currentData.underMaintenance || 0}/${totalCranes} Under Maintenance`,
      value: currentData.underMaintenance,
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
                  {!isInitialized ? '...' : (
                    card.id === 1 ? (
                      // ✅ Working Hours with smooth transitions
                      <SmoothTimeTransition
                        value={card.value}
                        formatFunction={(value) => {
                          const ongoingHours = card.ongoingHours || 0;
                          if (ongoingHours > 0) {
                            return `${formatHoursToHoursMinutes(Math.max(0, value))} + ${formatHoursToHoursMinutes(ongoingHours)} ongoing`;
                          } else {
                            return formatHoursToHoursMinutes(Math.max(0, value));
                          }
                        }}
                      />
                    ) : (
                      // ✅ Other cards with smooth number transitions
                      <SmoothNumberTransition
                        value={Math.max(0, card.value)}
                      />
                    )
                  )}
                </h3>
                <p className="mb-0" style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                  {!isInitialized ? '...' : card.title}
                </p>
                {/* ✅ Show subtitle for Working Hours card */}
                {card.id === 1 && card.subtitle && (
                  <p className="mb-0 mt-1" style={{ fontSize: '0.65rem', opacity: 0.7 }}>
                    {card.subtitle}
                  </p>
                )}
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

  // ✅ Show initial loading state
  if (!isInitialized) {
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

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={`${styles.mainCO} p-3`}>
      {/* ✅ Section 1: Header */}
      <div className="mb-2 d-flex justify-content-between align-items-center">
        <div>
          <h6 className="mb-0">Crane Overview Dashboard</h6>
          <p className="text-muted mb-0" style={{ fontSize: '0.65rem' }}>
            Overview of all crane operations and status
          </p>
          {/* ✅ Last updated timestamp */}
          <LastUpdatedTimestamp lastUpdated={lastUpdated} />
        </div>
        <div className="d-flex gap-2">
          {/* ✅ Manual refresh button */}
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={manualRefresh}
            style={{
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '0.8rem',
              fontWeight: '500',
              transition: 'all 0.3s ease'
            }}
            title="Refresh data now"
          >
            🔄 Refresh
          </button>
          
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
            {/* Quick Stats WITH TABS (Only this block changed) */}
            <Col xs={12} className="mb-2">
              <Card className="border-0 shadow-sm">
                <Card.Header className="py-2 bg-white border-bottom">
                  <div className="d-flex justify-content-between align-items-center">
                    <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
                      Quick Statistics
                    </h6>
                    <div className="d-flex gap-1">
                      <Button
                        size="sm"
                        variant={activeTab === 'working' ? 'primary' : 'outline-secondary'}
                        onClick={() => setActiveTab('working')}
                        style={{ fontSize: '0.6rem', padding: '0.25rem 0.5rem' }}
                      >
                        Working
                      </Button>
                      <Button
                        size="sm"
                        variant={activeTab === 'idle' ? 'primary' : 'outline-secondary'}
                        onClick={() => setActiveTab('idle')}
                        style={{ fontSize: '0.6rem', padding: '0.25rem 0.5rem' }}
                      >
                        Idle
                      </Button>
                      <Button
                        size="sm"
                        variant={activeTab === 'maintenance' ? 'primary' : 'outline-secondary'}
                        onClick={() => setActiveTab('maintenance')}
                        style={{ fontSize: '0.6rem', padding: '0.25rem 0.5rem' }}
                      >
                        Maint
                      </Button>
                    </div>
                  </div>
                </Card.Header>
                <Card.Body className="p-2">
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontSize: '0.6rem' }}>Today:</span>
                    <span className="fw-bold" style={{ fontSize: '0.6rem' }}>
                      {!isInitialized ? '...' : (
                        <SmoothTimeTransition
                          value={
                            activeTab === 'working' ? (currentData.quickStats?.today?.completed || 0) + (currentData.quickStats?.today?.ongoing || 0) :
                            activeTab === 'idle' ? (currentData.quickStats?.today?.idle || 0) :
                            (currentData.quickStats?.today?.maintenance || 0)
                          }
                          formatFunction={formatHoursToHoursMinutes}
                        />
                      )}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontSize: '0.6rem' }}>This Week:</span>
                    <span className="fw-bold" style={{ fontSize: '0.6rem' }}>
                      {!isInitialized ? '...' : (
                        <SmoothTimeTransition
                          value={
                            activeTab === 'working' ? (currentData.quickStats?.thisWeek?.completed || 0) + (currentData.quickStats?.thisWeek?.ongoing || 0) :
                            activeTab === 'idle' ? (currentData.quickStats?.thisWeek?.idle || 0) :
                            (currentData.quickStats?.thisWeek?.maintenance || 0)
                          }
                          formatFunction={formatHoursToHoursMinutes}
                        />
                      )}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontSize: '0.6rem' }}>This Month:</span>
                    <span className="fw-bold" style={{ fontSize: '0.6rem' }}>
                      {!isInitialized ? '...' : (
                        <SmoothTimeTransition
                          value={
                            activeTab === 'working' ? (currentData.quickStats?.thisMonth?.completed || 0) + (currentData.quickStats?.thisMonth?.ongoing || 0) :
                            activeTab === 'idle' ? (currentData.quickStats?.thisMonth?.idle || 0) :
                            (currentData.quickStats?.thisMonth?.maintenance || 0)
                          }
                          formatFunction={formatHoursToHoursMinutes}
                        />
                      )}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span style={{ fontSize: '0.6rem' }}>This Year:</span>
                    <span className="fw-bold" style={{ fontSize: '0.6rem' }}>
                      {!isInitialized ? '...' : (
                        <SmoothTimeTransition
                          value={
                            activeTab === 'working' ? (currentData.quickStats?.thisYear?.completed || 0) + (currentData.quickStats?.thisYear?.ongoing || 0) :
                            activeTab === 'idle' ? (currentData.quickStats?.thisYear?.idle || 0) :
                            (currentData.quickStats?.thisYear?.maintenance || 0)
                          }
                          formatFunction={formatHoursToHoursMinutes}
                        />
                      )}
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