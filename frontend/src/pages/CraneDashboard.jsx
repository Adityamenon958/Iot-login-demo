/* ─── imports ─── */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Col, Row, Form, Spinner, Card } from "react-bootstrap";
import axios from "axios";
import styles from "./MainContent.module.css";
import CraneOperatingChart from "../components/CraneOperatingChart";

/* ─── component ─── */
export default function CraneDashboard() {
  const navigate = useNavigate();

  /* crane devices & selection */
  const [craneDevices, setCraneDevices] = useState([]);   // [{ DeviceID, location }]
  const [selectedDevice, setSelectedDevice] = useState(""); // current DeviceID

  /* crane data */
  const [craneStatus, setCraneStatus] = useState(null);
  const [craneActivity, setCraneActivity] = useState(null);

  /* loading states */
  const [statusLoading, setStatusLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [initLoading, setInitLoading] = useState(true);

  /* ─── 1. fetch crane device list on mount ─── */
  useEffect(() => {
    const fetchCraneDevices = async () => {
      try {
        const devRes = await axios.get("/api/crane/devices", { withCredentials: true });
        
        setCraneDevices(devRes.data);
        if (devRes.data.length) setSelectedDevice(devRes.data[0].DeviceID);
      } catch (err) {
        console.error("Init fetch error", err);
        // Fallback to mock data if API fails
        const mockDevices = [
          { DeviceID: "No Data", location: "No crane data available" },
        ];
        setCraneDevices(mockDevices);
        if (mockDevices.length) setSelectedDevice(mockDevices[0].DeviceID);
      } finally {
        setInitLoading(false);
      }
    };

    fetchCraneDevices();
  }, []);

  /* ─── 2. fetch crane status when device changes ─── */
  useEffect(() => {
    if (!selectedDevice || selectedDevice === "No Data") return;

    const fetchCraneStatus = async () => {
      try {
        setStatusLoading(true);
        const res = await axios.get("/api/crane/status", {
          params: { deviceId: selectedDevice },
          withCredentials: true,
        });
        setCraneStatus(res.data);
      } catch (err) {
        console.error("Status fetch error", err);
        setCraneStatus(null);
      } finally {
        setStatusLoading(false);
      }
    };

    fetchCraneStatus();
  }, [selectedDevice]);

  /* ─── 3. fetch crane activity when device changes ─── */
  useEffect(() => {
    if (!selectedDevice || selectedDevice === "No Data") return;

    const fetchCraneActivity = async () => {
      try {
        setActivityLoading(true);
        const res = await axios.get("/api/crane/activity", {
          params: { deviceId: selectedDevice },
          withCredentials: true,
        });
        setCraneActivity(res.data);
      } catch (err) {
        console.error("Activity fetch error", err);
        setCraneActivity(null);
      } finally {
        setActivityLoading(false);
      }
    };

    fetchCraneActivity();
  }, [selectedDevice]);

  /* ─── render ─── */
  if (initLoading) {
    return (
      <Col className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
        <Spinner animation="border" />
      </Col>
    );
  }

  const activeDevice = craneDevices.find((d) => d.DeviceID === selectedDevice);

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={`${styles.craneMain}`}>
      {/* Row 1 - Crane Overview + Status Strip */}
      <Row className={`w-100 gx-2 ${styles.craneTopRow}`}>
        {/* Crane Overview */}
        <Col xs={12} lg={4} className={`${styles.panelDO} ${styles.cranePanel}`}>
          <div className={`${styles.panelInner} ${styles.cranePanelInner}`}>
            <h6 className="fw-bold mb-2">Crane Overview</h6>

            <Form.Select
              size="sm"
              value={selectedDevice}
              onChange={(e) => {
                setSelectedDevice(e.target.value);
                navigate(`/dashboard/crane`);
              }}
              className="mb-2"
            >
              {craneDevices.map((d) => (
                <option key={d.DeviceID} value={d.DeviceID}>
                  {d.DeviceID}
                </option>
              ))}
            </Form.Select>

            <ul className="list-unstyled mb-0 small">
              <li className="mb-1">
                <span className="text-muted">Device ID:&nbsp;</span>
                <span className="fw-semibold">{selectedDevice}</span>
              </li>
              <li className="mb-1">
                <span className="text-muted">Location:&nbsp;</span>
                <span className="fw-semibold">
                  {activeDevice?.location || "—"}
                </span>
              </li>
              <li className="mb-1">
                <span className="text-muted">Status:&nbsp;</span>
                <span className={`fw-semibold text-${craneStatus?.statusColor || 'secondary'}`}>
                  {statusLoading ? "Loading..." : (craneStatus?.status || "Unknown")}
                </span>
              </li>
              <li className="mb-1">
                <span className="text-muted">Last Update:&nbsp;</span>
                <span className="fw-semibold">
                  {craneStatus?.lastUpdate || "Never"}
                </span>
              </li>
            </ul>
          </div>
        </Col>

        {/* Crane Status Strip */}
        <Col xs={12} lg={8} className={`${styles.panelSG} ${styles.cranePanel}`}>
          <div className={`${styles.panelInner} ${styles.cranePanelInner}`}>
            <h6 className="fw-bold mb-2">Operating Status</h6>
            {statusLoading || activityLoading ? (
              <div className="d-flex justify-content-center py-2">
                <Spinner animation="border" size="sm" />
              </div>
            ) : (
              <Row className="g-2">
                {/* Current Status */}
                <Col xs={6} md={3}>
                  <Card className="text-center border-0 bg-light">
                    <Card.Body className="py-2">
                      <div className={`fw-bold text-${craneStatus?.statusColor || 'secondary'}`}>
                        {craneStatus?.isDown ? "⚠️" : craneStatus?.isOperating ? "🟢" : "⚪"}
                      </div>
                      <small className="text-muted">
                        {craneStatus?.isDown ? "Maintenance" : craneStatus?.isOperating ? "Operating" : "Idle"}
                      </small>
                    </Card.Body>
                  </Card>
                </Col>
                
                {/* Today's Hours */}
                <Col xs={6} md={3}>
                  <Card className="text-center border-0 bg-light">
                    <Card.Body className="py-2">
                      <div className="fw-bold">{craneActivity?.todayHours || 0}h</div>
                      <small className="text-muted">Today</small>
                    </Card.Body>
                  </Card>
                </Col>
                
                {/* Week's Hours */}
                <Col xs={6} md={3}>
                  <Card className="text-center border-0 bg-light">
                    <Card.Body className="py-2">
                      <div className="fw-bold">{craneActivity?.weekHours || 0}h</div>
                      <small className="text-muted">This Week</small>
                    </Card.Body>
                  </Card>
                </Col>
                
                {/* Month's Hours */}
                <Col xs={6} md={3}>
                  <Card className="text-center border-0 bg-light">
                    <Card.Body className="py-2">
                      <div className="fw-bold">{craneActivity?.monthHours || 0}h</div>
                      <small className="text-muted">This Month</small>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            )}
          </div>
        </Col>
      </Row>

      {/* Row 2 - Activity Table + Charts/Alarms */}
      <Row className={`w-100 gx-2 gy-2 ${styles.craneBottomRow} p-0`}>
        {/* Crane Activity Table */}
        <Col xs={12} lg={5} className={`${styles.panelST} ${styles.cranePanel}`}>
          <div className={`${styles.panelInner} ${styles.cranePanelInner}`}>
            <h6 className="fw-bold mb-2">Operating Sessions</h6>
            <div className="table-responsive">
              <table className="table table-sm table-hover">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Start Time</th>
                    <th>Stop Time</th>
                    <th>Total Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLoading ? (
                    <tr>
                      <td colSpan="4" className="text-center">
                        <Spinner animation="border" size="sm" />
                      </td>
                    </tr>
                  ) : craneActivity?.operatingSessions?.length > 0 ? (
                    craneActivity.operatingSessions.map((session, index) => (
                      <tr key={index}>
                        <td>
                          <small className="text-muted">
                            {session.date}
                          </small>
                        </td>
                        <td>{session.startTime}</td>
                        <td>
                          {session.stopTime === "Running..." ? (
                            <span className="badge bg-success">
                              {session.stopTime}
                            </span>
                          ) : (
                            session.stopTime
                          )}
                        </td>
                        <td>
                          <span className="fw-semibold text-primary">
                            {session.totalHours}h
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center text-muted">
                        No operating sessions
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Col>

        {/* Charts and Alarms */}
        <Col xs={12} lg={7} className={`d-flex flex-column gap-2 ${styles.panelLCAT} ${styles.cranePanel}`}>
          {/* Activity Chart */}
          <div className={`${styles.panelLC} ${styles.craneChart} flex-grow-1`}>
            <div className={`${styles.panelInner} ${styles.cranePanelInner}`}>
              <CraneOperatingChart deviceId={selectedDevice} />
            </div>
          </div>

          {/* Maintenance Status */}
          <div className={`${styles.panelAT} ${styles.craneAlarms}`} style={{ minHeight: "160px" }}>
            <div className={`${styles.panelInnertable} ${styles.cranePanelInner}`}>
              <h6 className="fw-bold mb-2">Maintenance Status</h6>
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Status</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusLoading ? (
                      <tr>
                        <td colSpan="3" className="text-center">
                          <Spinner animation="border" size="sm" />
                        </td>
                      </tr>
                    ) : craneStatus ? (
                      <>
                        <tr>
                          <td>Operating</td>
                          <td>
                            <span className={`badge bg-${craneStatus.isOperating ? 'success' : 'secondary'}`}>
                              {craneStatus.isOperating ? 'ON' : 'OFF'}
                            </span>
                          </td>
                          <td>{craneStatus.digitalInput1}</td>
                        </tr>
                        <tr>
                          <td>Maintenance</td>
                          <td>
                            <span className={`badge bg-${craneStatus.isDown ? 'warning' : 'success'}`}>
                              {craneStatus.isDown ? 'DOWN' : 'OK'}
                            </span>
                          </td>
                          <td>{craneStatus.digitalInput2}</td>
                        </tr>
                      </>
                    ) : (
                      <tr>
                        <td colSpan="3" className="text-center text-muted">
                          No status data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Col>
      </Row>
    </Col>
  );
} 