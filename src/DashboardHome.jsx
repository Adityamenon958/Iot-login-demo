import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Col, Row, Card, Table, Button, Form } from 'react-bootstrap';
import styles from './MainContent.module.css';
import './MainContent.css';

const DashboardHome = () => {
  const [activeDevices, setActiveDevices] = useState(0);
  const [inactiveDevices, setInactiveDevices] = useState(0);
  const [alarms, setAlarms] = useState(0);
  const [deviceData, setDeviceData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch card data
    axios.get('http://localhost:5000/api/dashboard')
      .then(res => {
        setActiveDevices(res.data.activeDevices);
        setInactiveDevices(res.data.inactiveDevices);
        setAlarms(res.data.alarms);
      })
      .catch(err => console.error("Dashboard API error:", err));

    // Fetch table data
    axios.get('http://localhost:5000/api/devices')
      .then(res => {
        console.log("Fetched devices:", res.data); 
        setDeviceData(res.data);
        setLoading(false);  // Set loading to false after data is fetched
      })
      .catch(err => {
        console.error("Devices API error:", err);
        setLoading(false);
      });
  }, []);

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main}>
      <div className="p-3">
        <Row className="g-4">
          <Col xs={12} md={4}>
            <Card className={`${styles.deviceCard} text-center`}>
              <Card.Body>
                <i className={`bi bi-hdd-stack-fill text-primary ${styles.deviceIcon}`}></i>
                <Card.Title className={styles.cardTitle}>Active Devices</Card.Title>
                <div className={styles.metricNumber}>{activeDevices}</div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} md={4}>
            <Card className={`${styles.deviceCard} text-center`}>
              <Card.Body>
                <i className={`bi bi-hdd text-secondary ${styles.deviceIcon}`}></i>
                <Card.Title className={styles.cardTitle}>Inactive Devices</Card.Title>
                <div className={styles.metricNumber}>{inactiveDevices}</div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} md={4}>
            <Card className={`${styles.deviceCard} text-center`}>
              <Card.Body>
                <i className={`bi bi-exclamation-triangle-fill text-danger ${styles.deviceIcon}`}></i>
                <Card.Title className={styles.cardTitle}>Alarms</Card.Title>
                <div className={styles.metricNumber}>{alarms}</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Table Section */}
      <div className="mt-4">
        <h5>Device List</h5>
        {loading ? (
          <div>Loading...</div> // Add a better loading spinner here
        ) : (
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th><Form.Check type="checkbox" /></th>
                <th>Device ID</th>
                <th>Device Name</th>
                <th>Location</th>
                <th>View Logs</th>
                <th>Subscription</th>
              </tr>
            </thead>
            <tbody>
              {deviceData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center">No devices found</td>
                </tr>
              ) : (
                deviceData.map((device) => (
                  <tr key={device.id}>
                    <td><Form.Check type="checkbox" /></td>
                    <td>{device.id}</td>
                    <td>{device.name}</td>
                    <td>{device.location}</td>
                    <td>
                      <Button variant="outline-primary" size="sm">
                        View Logs
                      </Button>
                    </td>
                    <td>{device.subscription}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        )}
      </div>
    </Col>
  );
};

export default DashboardHome;
