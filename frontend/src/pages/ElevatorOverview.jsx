import React, { useEffect, useState, useMemo } from 'react';
import { Col, Row, Card, Badge } from 'react-bootstrap';
import styles from "./MainContent.module.css";
import { PiElevatorDuotone, PiCheckCircleDuotone, PiXCircleDuotone, PiWarningCircleDuotone } from "react-icons/pi";

// ✅ Format helpers
const formatDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
};

const formatTimeAgo = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export default function ElevatorOverview() {
  // ✅ Mock data for now - will be replaced with real API calls later
  const [elevators] = useState([
    {
      id: "ELEV001",
      company: "Gsn Soln",
      location: "Hospital A - Floor 3",
      status: "active",
      lastUpdate: new Date(Date.now() - 5 * 60000), // 5 minutes ago
      data: ["AA12", "AA10", "AB16", "AB11"]
    },
    {
      id: "ELEV002", 
      company: "Gsn Soln",
      location: "Hospital A - Floor 5",
      status: "inactive",
      lastUpdate: new Date(Date.now() - 15 * 60000), // 15 minutes ago
      data: ["AA10", "AA12", "AB15", "AB10"]
    },
    {
      id: "ELEV003",
      company: "Gsn Soln", 
      location: "Hospital B - Floor 2",
      status: "error",
      lastUpdate: new Date(Date.now() - 2 * 60000), // 2 minutes ago
      data: ["AB16", "AB11", "AA12", "AA10"]
    },
    {
      id: "ELEV004",
      company: "Gsn Soln",
      location: "Hospital B - Floor 4", 
      status: "active",
      lastUpdate: new Date(Date.now() - 1 * 60000), // 1 minute ago
      data: ["AA12", "AA10", "AB16", "AB11"]
    },
    {
      id: "ELEV005",
      company: "Gsn Soln",
      location: "Hospital C - Floor 1",
      status: "inactive", 
      lastUpdate: new Date(Date.now() - 30 * 60000), // 30 minutes ago
      data: ["AA10", "AA12", "AB15", "AB10"]
    },
    {
      id: "ELEV006",
      company: "Gsn Soln",
      location: "Hospital C - Floor 3",
      status: "active",
      lastUpdate: new Date(Date.now() - 3 * 60000), // 3 minutes ago
      data: ["AA12", "AA10", "AB16", "AB11"]
    }
  ]);

  // ✅ Calculate stats from mock data
  const stats = useMemo(() => {
    const active = elevators.filter(e => e.status === 'active').length;
    const inactive = elevators.filter(e => e.status === 'inactive').length;
    const error = elevators.filter(e => e.status === 'error').length;
    return { active, inactive, error, total: elevators.length };
  }, [elevators]);

  const getStatusBadge = (status) => {
    const variants = {
      active: { bg: "success", text: "Active" },
      inactive: { bg: "secondary", text: "Inactive" },
      error: { bg: "danger", text: "Error" }
    };
    const variant = variants[status] || variants.inactive;
    return <Badge bg={variant.bg} className="px-2 py-1">{variant.text}</Badge>;
  };

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={`${styles.mainCO} p-3`}>
      {/* Header */}
      <div className="mb-4">
        <h4 className="mb-1 fw-bold">Elevator Dashboard</h4>
        <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
          Real-time monitoring of elevator systems across all locations
        </p>
      </div>

      {/* Top Status Cards - Blue Theme */}
      <Row className="mb-4">
        <Col xs={12} md={4} className="mb-3">
          <Card className="h-100 border-0 shadow-lg" style={{ 
            background: "linear-gradient(135deg, #1a5f7a 0%, #4facfe 100%)",
            minHeight: '120px',
            borderRadius: '15px'
          }}>
            <Card.Body className="p-4 text-white position-relative">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h2 className="mb-1 fw-bold" style={{ fontSize: '2.5rem' }}>
                    {stats.active}
                  </h2>
                  <p className="mb-0 fw-medium" style={{ fontSize: '1rem', opacity: 0.9 }}>
                    Active Elevators
                  </p>
                </div>
                <div style={{ opacity: 0.8 }}>
                  <PiCheckCircleDuotone size={50} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} md={4} className="mb-3">
          <Card className="h-100 border-0 shadow-lg" style={{ 
            background: "linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)",
            minHeight: '120px',
            borderRadius: '15px'
          }}>
            <Card.Body className="p-4 text-white position-relative">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h2 className="mb-1 fw-bold" style={{ fontSize: '2.5rem' }}>
                    {stats.inactive}
                  </h2>
                  <p className="mb-0 fw-medium" style={{ fontSize: '1rem', opacity: 0.9 }}>
                    Inactive Elevators
                  </p>
                </div>
                <div style={{ opacity: 0.8 }}>
                  <PiXCircleDuotone size={50} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} md={4} className="mb-3">
          <Card className="h-100 border-0 shadow-lg" style={{ 
            background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            minHeight: '120px',
            borderRadius: '15px'
          }}>
            <Card.Body className="p-4 text-white position-relative">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h2 className="mb-1 fw-bold" style={{ fontSize: '2.5rem' }}>
                    {stats.error}
                  </h2>
                  <p className="mb-0 fw-medium" style={{ fontSize: '1rem', opacity: 0.9 }}>
                    Error Status
                  </p>
                </div>
                <div style={{ opacity: 0.8 }}>
                  <PiWarningCircleDuotone size={50} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Individual Elevator Cards - Grey Theme */}
      <div className="mb-3">
        <Row>
          {elevators.map((elevator) => (
            <Col xs={12} sm={6} md={4} lg={2} className="mb-3" key={elevator.id}>
              <Card 
                className="h-100 border-0 shadow-sm elevator-card" 
                style={{ 
                  borderRadius: '12px',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
                }}
              >
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <Badge bg="dark" className="px-2 py-1" style={{ fontSize: '0.7rem' }}>
                      {elevator.id}
                    </Badge>
                    {getStatusBadge(elevator.status)}
                  </div>
                  
                  <div className="mb-2">
                    <h6 className="mb-1 fw-bold" style={{ fontSize: '0.85rem' }}>
                      {elevator.company}
                    </h6>
                    <p className="mb-1 text-muted" style={{ fontSize: '0.75rem' }}>
                      {elevator.location}
                    </p>
                  </div>

                  <div className="mb-2">
                    <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                      Last Update: {formatTimeAgo(elevator.lastUpdate)}
                    </small>
                  </div>

                  <div>
                    <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                      Data: {elevator.data.slice(0, 2).join(', ')}...
                    </small>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </Col>
  );
} 