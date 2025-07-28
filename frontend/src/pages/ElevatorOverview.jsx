import React from 'react';
import { Col, Row, Card } from 'react-bootstrap';
import styles from "./MainContent.module.css";
// ✅ Import icons from react-icons
import { PiElevatorDuotone, PiTimerDuotone, PiBandaidsFill } from "react-icons/pi";
import { GiNightSleep } from "react-icons/gi";

export default function ElevatorOverview() {
  return (
    <Col xs={12} md={9} lg={10} xl={10} className={`${styles.mainCO} p-3`}>
      {/* ✅ Section 1: Header */}
      <div className="mb-2">
        <h6 className="mb-0">Elevator Overview Dashboard</h6>
        <p className="text-muted mb-0" style={{ fontSize: '0.65rem' }}>
          Overview of all elevator operations and status
        </p>
      </div>

      {/* ✅ Section 2: Top Row - 4 Summary Cards */}
      <Row className="mb-3">
        {/* Card 1: Total Operating Hours */}
        <Col xs={6} sm={6} md={3} className="mb-2">
          <Card 
            className="h-100 border-0 shadow-sm" 
            style={{ 
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              minHeight: '120px'
            }}
          >
            <Card.Body className="p-3 text-white position-relative">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h3 className="mb-1 fw-bold" style={{ fontSize: '1.8rem' }}>
                    0h 0m
                  </h3>
                  <p className="mb-0" style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                    Total Operating Hours (July 2025)
                  </p>
                </div>
                <div style={{ opacity: 0.8 }}>
                  <PiTimerDuotone size={60} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Card 2: Active Elevators */}
        <Col xs={6} sm={6} md={3} className="mb-2">
          <Card 
            className="h-100 border-0 shadow-sm" 
            style={{ 
              background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
              minHeight: '120px'
            }}
          >
            <Card.Body className="p-3 text-white position-relative">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h3 className="mb-1 fw-bold" style={{ fontSize: '1.8rem' }}>
                    0
                  </h3>
                  <p className="mb-0" style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                    Active Elevators
                  </p>
                </div>
                <div style={{ opacity: 0.8 }}>
                  <PiElevatorDuotone size={60} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Card 3: Inactive Elevators */}
        <Col xs={6} sm={6} md={3} className="mb-2">
          <Card 
            className="h-100 border-0 shadow-sm" 
            style={{ 
              background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
              minHeight: '120px'
            }}
          >
            <Card.Body className="p-3 text-white position-relative">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h3 className="mb-1 fw-bold" style={{ fontSize: '1.8rem' }}>
                    0
                  </h3>
                  <p className="mb-0" style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                    Inactive Elevators
                  </p>
                </div>
                <div style={{ opacity: 0.8 }}>
                  <GiNightSleep size={60} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Card 4: Under Maintenance */}
        <Col xs={6} sm={6} md={3} className="mb-2">
          <Card 
            className="h-100 border-0 shadow-sm" 
            style={{ 
              background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
              minHeight: '120px'
            }}
          >
            <Card.Body className="p-3 text-white position-relative">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h3 className="mb-1 fw-bold" style={{ fontSize: '1.8rem' }}>
                    0
                  </h3>
                  <p className="mb-0" style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                    Under Maintenance
                  </p>
                </div>
                <div style={{ opacity: 0.8 }}>
                  <PiBandaidsFill size={60} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ✅ Section 3: Middle Section - Two Columns */}
      <Row className="mb-3">
        {/* Left Column - Charts */}
        <Col xs={12} lg={7} className="mb-2">
          <Row>
            {/* Monthly Operating Chart */}
            <Col xs={12} className="mb-2">
              <Card className="border-0 shadow-sm">
                <Card.Header className="py-2 bg-white border-bottom">
                  <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
                    Monthly Operating Hours
                  </h6>
                </Card.Header>
                <Card.Body className="p-2" style={{ height: '200px' }}>
                  <div className="d-flex justify-content-center align-items-center h-100">
                    <p className="text-muted mb-0" style={{ fontSize: '0.65rem' }}>
                      Chart component will be added here
                    </p>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Individual Elevator Performance */}
            <Col xs={12}>
              <Card className="border-0 shadow-sm">
                <Card.Header className="py-2 bg-white border-bottom">
                  <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
                    Individual Elevator Performance
                  </h6>
                </Card.Header>
                <Card.Body className="p-2" style={{ height: '200px' }}>
                  <div className="d-flex justify-content-center align-items-center h-100">
                    <p className="text-muted mb-0" style={{ fontSize: '0.65rem' }}>
                      Bar chart component will be added here
                    </p>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Right Column - Stats & Updates */}
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
                      0h 0m
                    </span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontSize: '0.6rem' }}>This Week:</span>
                    <span className="fw-bold" style={{ fontSize: '0.6rem' }}>
                      0h 0m
                    </span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontSize: '0.6rem' }}>This Month:</span>
                    <span className="fw-bold" style={{ fontSize: '0.6rem' }}>
                      0h 0m
                    </span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span style={{ fontSize: '0.6rem' }}>This Year:</span>
                    <span className="fw-bold" style={{ fontSize: '0.6rem' }}>
                      0h 0m
                    </span>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Previous Month Performance */}
            <Col xs={12} className="mb-2">
              <Card className="border-0 shadow-sm">
                <Card.Header className="py-2 bg-white border-bottom">
                  <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
                    Previous Month Performance
                  </h6>
                </Card.Header>
                <Card.Body className="p-2">
                  <div className="d-flex justify-content-center align-items-center" style={{ height: '120px' }}>
                    <p className="text-muted mb-0" style={{ fontSize: '0.65rem' }}>
                      Previous month stats component will be added here
                    </p>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Maintenance Updates */}
            <Col xs={12}>
              <Card className="border-0 shadow-sm">
                <Card.Header className="py-2 bg-white border-bottom">
                  <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>
                    Maintenance Updates
                  </h6>
                </Card.Header>
                <Card.Body className="p-2">
                  <div className="d-flex justify-content-center align-items-center" style={{ height: '120px' }}>
                    <p className="text-muted mb-0" style={{ fontSize: '0.65rem' }}>
                      Maintenance updates component will be added here
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