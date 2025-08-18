import React, { useState, useEffect } from 'react';
import { Col, Row, Card, Button, Form } from 'react-bootstrap';
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
import PreviousMonthStatsContent from '../components/PreviousMonthStatsContent';
// ✅ Import MaintenanceUpdates component
import MaintenanceUpdates from '../components/MaintenanceUpdates';
import CraneDistanceChart from '../components/CraneDistanceChart';
import CraneDetails from '../components/CraneDetails';
import ExportModal from '../components/ExportModal';
// ✅ Import background refresh hook and components
import { useBackgroundRefresh } from '../hooks/useBackgroundRefresh';
import { SmoothValueTransition, SmoothNumberTransition, SmoothTimeTransition } from '../components/SmoothValueTransition';
import { LastUpdatedTimestamp } from '../components/LastUpdatedTimestamp';
import FilterChips from '../components/FilterChips';
import FiltersButton from '../components/FiltersButton';

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
  const [filters, setFilters] = useState({ cranes: [], start: '', end: '' });
  const [appliedFilters, setAppliedFilters] = useState({ cranes: [], start: '', end: '' });
  const [filteredTotals, setFilteredTotals] = useState(null);
  const [isPerformanceCollapsed, setIsPerformanceCollapsed] = useState(true); // Start collapsed
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  // ✅ Background refresh hook for dashboard data (restored)
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

  // ✅ Initialize with default data (restored)
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

  // ✅ Use dashboard data or default (restored)
  const currentData = dashboardData || defaultData;

  // ✅ Available cranes from overview (once loaded) (restored)
  const availableCranes = (dashboardData?.craneDevices || []).sort();

  // ✅ Toggle performance component collapse
  const togglePerformanceCollapse = () => {
    setIsPerformanceCollapsed(!isPerformanceCollapsed);
  };

  // ✅ Handle month selection change
  const handleMonthChange = (event) => {
    const [month, year] = event.target.value.split('-').map(Number);
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  // ✅ Helper function to get formatted date labels for Quick Statistics (restored)
  const getDateLabels = () => {
    const now = new Date();
    const todayLabel = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekStartLabel = weekAgo.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    const weekEndLabel = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    const monthLabel = now.toLocaleDateString('en-US', { month: 'short' });
    const yearLabel = now.getFullYear().toString();
    return { today: todayLabel, thisWeek: `${weekStartLabel} - ${weekEndLabel}`, thisMonth: monthLabel, thisYear: yearLabel };
  };

  // ✅ Get date labels (restored)
  const dateLabels = getDateLabels();

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

  // ✅ Handler for crane selection (restored)
  const handleCraneSelect = (craneData) => {
    console.log('🔍 Crane selected in CraneOverview:', craneData);
    setSelectedCrane(craneData);
  };

  // ✅ Handler for export modal (restored)
  const handleExportModal = () => {
    setShowExportModal(true);
  };

  // ✅ Calculate total cranes for fraction display (restored)
  const totalCranes = (currentData.activeCranes || 0) + (currentData.inactiveCranes || 0) + (currentData.underMaintenance || 0);

  // Apply from FiltersButton will call this
  const onApplyFilters = (f) => {
    setAppliedFilters(f || { cranes: [], start: '', end: '' });
    setFilters(f || { cranes: [], start: '', end: '' });
  };

  // Fetch filtered totals for first card when applied filters change
  useEffect(() => {
    const hasCrane = appliedFilters.cranes && appliedFilters.cranes.length > 0;
    const hasRange = appliedFilters.start && appliedFilters.end;
    if (!hasCrane && !hasRange) { setFilteredTotals(null); return; }
    const load = async () => {
      try {
        const params = {};
        if (hasCrane) params.cranes = appliedFilters.cranes.join(',');
        if (hasRange) { params.start = appliedFilters.start; params.end = appliedFilters.end; }
        const resp = await axios.get('/api/crane/working-totals', { params, withCredentials: true });
        if (resp.data?.success) setFilteredTotals(resp.data);
        else setFilteredTotals(null);
      } catch (e) { console.error('working totals error', e); setFilteredTotals(null); }
    };
    load();
  }, [appliedFilters.cranes, appliedFilters.start, appliedFilters.end]);

  // Helper to format period title
  const formatPeriodTitle = () => {
    if (appliedFilters.start && appliedFilters.end) {
      const s = new Date(appliedFilters.start);
      const e = new Date(appliedFilters.end);
      const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      return `Total Working Hours (${fmt(s)} – ${fmt(e)})`;
    }
    return `Total Working Hours (${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()})`;
  };

  // Build first card data
  const workingCompleted = filteredTotals ? filteredTotals.workingCompleted : (currentData.quickStats?.thisMonth?.completed || 0);
  const workingOngoing = filteredTotals ? filteredTotals.workingOngoing : (currentData.quickStats?.thisMonth?.ongoing || 0);
  const cranesCount = filteredTotals ? filteredTotals.cranesCount : totalCranes;
  const cranesList = filteredTotals ? filteredTotals.cranesList : [];

  // When filters are applied, show the filtered totals
  const isFiltered = !!filteredTotals;
  const firstCardValue = workingCompleted;
  const firstCardOngoing = workingOngoing;

  const firstCard = {
      id: 1,
    title: formatPeriodTitle(),
    subtitle: filteredTotals
      ? `${cranesCount} Total Cranes${cranesList.length === 1 ? ` (${cranesList[0]})` : cranesList.length > 1 ? ` (${cranesList.slice(0,2).join(', ')}${cranesList.length>2 ? `, +${cranesList.length-2}`:''})` : ''}`
      : `${totalCranes} Total Cranes`,
    value: firstCardValue,
    ongoingHours: firstCardOngoing,
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      icon: PiTimerDuotone,
      iconSize: 60
  };

  // Replace first item in summaryCards
  const summaryCards = [
    firstCard,
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
        <div className="d-flex gap-2 align-items-center">
          {/* ✅ Compact filters: chips + button */}
          <FilterChips filters={filters} onClick={() => { /* open via button click */ }} />
          <FiltersButton
            cranes={availableCranes}
            initial={filters}
            onApply={onApplyFilters}
            onReset={() => setFilters({ cranes: [], start: '', end: '' })}
          />

          {/* ✅ Manual refresh button */}
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={manualRefresh}
            style={{
              borderRadius: '8px',
              padding: '0 12px',
              fontSize: '0.8rem',
              fontWeight: '500',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '36px'
            }}
            title="Refresh data now"
          >
            <span className="bi bi-arrow-repeat" /> Refresh
          </button>
          
          <button
            className="btn btn-primary btn-sm"
            onClick={handleExportModal}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '8px',
              padding: '0 12px',
              fontSize: '0.8rem',
              fontWeight: '500',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '36px'
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
            <span className="bi bi-file-earmark-arrow-down" /> Generate Report
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
        <Col xs={12} lg={7} className="mb-2 bg-danger">
          <Card className="border-0 shadow-sm" style={{ height: '400px' }}>
            <Card.Header className="py-2 bg-white border-bottom">
              <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
                Crane Activity Trend
              </h6>
            </Card.Header>
            <Card.Body className="p-2" style={{ padding: '8px !important' }}>
              {/* Upper Half - Line Chart Section */}
              <div 
                style={{ 
                  height: '55%', 
                  backgroundColor: '#f8f9fa',
                  borderBottom: '1px solid #dee2e6',
                  marginBottom: '4px',
                  minHeight: '180px'
                }}
              >
                <MonthlyChart 
                  selectedCranes={appliedFilters.cranes}
                  start={appliedFilters.start}
                  end={appliedFilters.end}
                />
              </div>
              
              {/* Lower Half - Bar Chart Section */}
              <div 
                style={{ 
                  height: '45%', 
                  backgroundColor: '#f8f9fa',
                  minHeight: '140px'
                }}
              >
                <CraneBarChart 
                  selectedCranes={appliedFilters.cranes}
                  start={appliedFilters.start}
                  end={appliedFilters.end}
                />
              </div>
            </Card.Body>
          </Card>

          {/* Previous Month Performance - Now inside left column */}
          <Card className="border-0 shadow-sm mt-2">
            <Card.Header 
              className={`py-2 bg-white border-bottom ${styles.collapsibleHeader}`}
              onClick={togglePerformanceCollapse}
            >
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
                  Previous Month Performance
                </h6>
                <div className="d-flex align-items-center gap-2">
                  {/* Month Selection Dropdown - Only visible when expanded */}
                  {!isPerformanceCollapsed && (
                    <Form.Select 
                      size="sm"
                      style={{ fontSize: '0.6rem', width: 'auto' }}
                      value={selectedMonth !== '' ? `${selectedMonth}-${selectedYear}` : ''}
                      onChange={handleMonthChange}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">Auto (Previous)</option>
                      {monthOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Form.Select>
                  )}

                  <span style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                    {isPerformanceCollapsed ? '▼' : '▲'}
                  </span>
                </div>
              </div>
            </Card.Header>
            <div 
              style={{
                height: isPerformanceCollapsed ? '0px' : 'auto',
                overflow: isPerformanceCollapsed ? 'hidden' : 'visible',
                opacity: isPerformanceCollapsed ? 0 : 1,
                transition: 'height 0.3s ease-in-out, opacity 0.3s ease-in-out'
              }}
            >
              <Card.Body className="p-2">
                <PreviousMonthStatsContent 
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                />
              </Card.Body>
            </div>
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
                    <span style={{ fontSize: '0.6rem' }}>
                      Today ({dateLabels.today}):
                    </span>
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
                    <span style={{ fontSize: '0.6rem' }}>
                      This Week ({dateLabels.thisWeek}):
                    </span>
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
                    <span style={{ fontSize: '0.6rem' }}>
                      This Month ({dateLabels.thisMonth}):
                    </span>
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
                    <span style={{ fontSize: '0.6rem' }}>
                      This Year ({dateLabels.thisYear}):
                    </span>
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



            {/* Maintenance Updates */}
            <Col xs={12} className="mb-2">
              <MaintenanceUpdates />
            </Col>

            {/* Live Crane Locations */}
            <Col xs={12}>
              <Card className="border-0 shadow-sm">
                <Card.Header className="py-2 bg-white border-bottom">
                  <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
                    Live Crane Locations
                  </h6>
                </Card.Header>
                <Card.Body className="p-3" style={{ height: '200px', backgroundColor: '#f8f9fa' }}>
                  <div className="d-flex align-items-center justify-content-center h-100">
                    <div className="text-center text-muted">
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗺️</div>
                      <p className="mb-0" style={{ fontSize: '0.8rem' }}>
                        Interactive map component will be added here
                      </p>
                      <small className="text-muted" style={{ fontSize: '0.6rem' }}>
                        Showing real-time crane locations with hover details
                      </small>
                    </div>
                  </div>
                </Card.Body>
              </Card>
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