import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Col, Row, Card, Table, Form, Button, Badge, Spinner } from 'react-bootstrap';
import styles from "./MainContent.module.css";
import { PiElevatorDuotone } from "react-icons/pi";

// ✅ Format helpers
const formatDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
};

export default function ElevatorOverview() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [limit, setLimit] = useState(50);

  // ✅ Fetch recent logs from backend (cookie-protected)
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = {};
      if (deviceId) params.deviceId = deviceId.trim();
      if (limit) params.limit = limit;
      const res = await axios.get("/api/elevators/recent", {
        params,
        withCredentials: true // ✅ required by project auth rules
      });
      setRows(res.data?.logs || []);
    } catch (err) {
      console.error("Failed to fetch elevator logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    let t;
    if (autoRefresh) {
      t = setInterval(fetchLogs, 5000); // poll every 5s for simple verification
    }
    return () => t && clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, autoRefresh, limit]);

  const total = rows.length;
  const byDevice = useMemo(() => {
    const map = new Map();
    for (const r of rows) map.set(r.DeviceID, (map.get(r.DeviceID) || 0) + 1);
    return map;
  }, [rows]);

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={`${styles.mainCO} p-3`}>
      {/* Header */}
      <div className="mb-2">
        <h6 className="mb-0">Elevator Ingestion Monitor</h6>
        <p className="text-muted mb-0" style={{ fontSize: '0.65rem' }}>
          Live view of the latest elevator payloads received from gateway
        </p>
      </div>

      {/* Controls */}
      <Card className="border-0 shadow-sm mb-3">
        <Card.Body className="p-2">
          <Form className="row g-2 align-items-center">
            <div className="col-auto">
              <Form.Label htmlFor="deviceId" className="mb-0" style={{ fontSize: '0.75rem' }}>
                Filter by DeviceID
              </Form.Label>
              <Form.Control
                id="deviceId"
                size="sm"
                placeholder="ELEV001"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              />
            </div>
            <div className="col-auto">
              <Form.Label htmlFor="limit" className="mb-0" style={{ fontSize: '0.75rem' }}>
                Limit
              </Form.Label>
              <Form.Select id="limit" size="sm" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                {[20, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
              </Form.Select>
            </div>
            <div className="col-auto">
              <Form.Check
                type="switch"
                id="autorefresh"
                label="Auto refresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            </div>
            <div className="col-auto">
              <Button size="sm" onClick={fetchLogs} disabled={loading}>
                {loading ? <Spinner animation="border" size="sm" /> : "Refresh"}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      {/* Summary cards */}
      <Row className="mb-2">
        <Col xs={6} sm={4} md={3} className="mb-2">
          <Card className="h-100 border-0 shadow-sm" style={{ minHeight: '90px', background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" }}>
            <Card.Body className="p-2 text-white position-relative">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h5 className="mb-0 fw-bold">{total}</h5>
                  <small>Rows (latest)</small>
                </div>
                <div style={{ opacity: 0.8 }}>
                  <PiElevatorDuotone size={40} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} sm={4} md={3} className="mb-2">
          <Card className="h-100 border-0 shadow-sm" style={{ minHeight: '90px' }}>
            <Card.Body className="p-2">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="fw-bold" style={{ fontSize: '0.85rem' }}>Devices seen</div>
                  <div style={{ fontSize: '0.75rem' }}>{byDevice.size}</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="py-2 bg-white border-bottom">
          <h6 className="mb-0" style={{ fontSize: '0.75rem' }}>Recent Logs</h6>
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table size="sm" hover className="mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ whiteSpace: 'nowrap' }}>Time</th>
                  <th>Company</th>
                  <th>DeviceID</th>
                  <th>Type</th>
                  <th>Data</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Raw TS</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.Timestamp)}</td>
                    <td>{r.elevatorCompany || "-"}</td>
                    <td><Badge bg="secondary">{r.DeviceID}</Badge></td>
                    <td>{r.dataType || "-"}</td>
                    <td><code className="small">{Array.isArray(r.data) ? JSON.stringify(r.data) : "-"}</code></td>
                    <td>{r.Timestamp ? new Date(r.Timestamp).getTime() / 1000 : "-"}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-3" style={{ fontSize: '0.8rem' }}>
                      No data yet. Waiting for gateway…
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </Col>
  );
} 