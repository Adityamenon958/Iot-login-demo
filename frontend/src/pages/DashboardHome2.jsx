import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Col, Row, Card, Table, Form } from 'react-bootstrap';
import styles from './MainContent.module.css';
import './MainContent.css';

const DashboardHome2 = () => {
  const [activeDevices, setActiveDevices] = useState(0);
  const [inactiveDevices, setInactiveDevices] = useState(0);
  const [alarms, setAlarms] = useState(0);
  const [sensorData, setSensorData] = useState([]);
  const [loading, setLoading] = useState(true);
  
const [filteredSensorData, setFilteredSensorData] = useState([]);
const [devices, setDevices] = useState([]);

const fetchDevices = async () => {
  try {
    const companyName = localStorage.getItem('companyName');
    const res = await axios.get('/api/devices', { params: { companyName } });
    setDevices(res.data);
  } catch (err) {
    console.error("Device API error:", err);
    setDevices([]);
  }
};


  const fetchSensorData = async () => {
    try {
      // const res = await axios.get(`https://iot-dashboard-adi.azurewebsites.net/api/levelsensor`);
      const res = await axios.get(`https://gsn-iot-dashboard-hhbgdjfmhvfjekex.canadacentral-01.azurewebsites.net/api/levelsensor`);
      console.log("Sensor Data API response:", res.data);

      if (Array.isArray(res.data)) {
        setSensorData(res.data);
      } else {
        console.error("❌ Unexpected sensor data format. Expected array.");
        setSensorData([]);
      }

      setLoading(false);
    } catch (err) {
      console.error("❌ Sensor Data API error:", err);
      setSensorData([]);
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      // const res = await axios.get(`https://iot-dashboard-adi.azurewebsites.net/api/dashboard`);
      const res = await axios.get(`https://gsn-iot-dashboard-hhbgdjfmhvfjekex.canadacentral-01.azurewebsites.net/api/dashboard`);
      console.log("Dashboard API response:", res.data);
      setActiveDevices(res.data.activeDevices);
      setInactiveDevices(res.data.inactiveDevices);
      setAlarms(res.data.alarms);
    } catch (err) {
      console.error("Dashboard API error:", err);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      await fetchDashboardStats();
  
      try {
        const companyName = localStorage.getItem('companyName');
  
        // Fetch both in parallel
        const [deviceRes, sensorRes] = await Promise.all([
          axios.get('/api/devices', { params: { companyName } }),
          axios.get('/api/levelsensor')
        ]);
  
        const devicesData = deviceRes.data || [];
        const sensorDataRaw = sensorRes.data || [];
  
        const deviceUids = devicesData.map(dev => dev.uid);
        console.log("✅ Device UIDs:", deviceUids);
  
        const allSensorUids = sensorDataRaw.map(s => s.uid);
        console.log("📦 All Sensor UIDs:", allSensorUids);
  
        const allowedUids = new Set(deviceUids);
        const filtered = sensorDataRaw.filter(s => allowedUids.has(s.uid));
  
        const filteredUids = filtered.map(s => s.uid);
        console.log("🔍 Filtered Sensor UIDs:", filteredUids);
  
        setDevices(devicesData);
        setSensorData(sensorDataRaw);
        setFilteredSensorData(filtered);
        setLoading(false);
      } catch (err) {
        console.error("❌ Data fetching error:", err);
        setLoading(false);
      }
    };
  
    fetchAll();
  }, []);
  
  

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main}>
      <div className="p-3">
        <Row className="g-4">
          <Col xs={12} sm={4} md={4}>
            <Card className={`${styles.deviceCard} text-center`}>
              <Card.Body>
                <i className={`bi bi-hdd-stack-fill text-primary ${styles.deviceIcon}`}></i>
                <Card.Title className={styles.cardTitle}>Active Devices</Card.Title>
                <div className={styles.metricNumber}>{activeDevices}</div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} sm={4} md={4}>
            <Card className={`${styles.deviceCard} text-center`}>
              <Card.Body>
                <i className={`bi bi-hdd text-secondary ${styles.deviceIcon}`}></i>
                <Card.Title className={styles.cardTitle}>Inactive Devices</Card.Title>
                <div className={styles.metricNumber}>{inactiveDevices}</div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} sm={4} md={4}>
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
        <h5>Sensor Data Logs</h5>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className='tableScroll mb-2'>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th><Form.Check type="checkbox" disabled /></th>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Data</th>
                  <th>Vehicle Number</th>
                </tr>
              </thead>
              <tbody>
  {filteredSensorData.length === 0 ? (
    <tr>
      <td colSpan="5" className="text-center">No sensor data found</td>
    </tr>
  ) : (
    filteredSensorData.map((item) => (
      <tr key={item._id}>
        <td><Form.Check type="checkbox" /></td>
        <td>{item.D}</td>
        <td>{item.address}</td>
        <td>{item.data} mm</td>
        <td>{item.vehicleNo}</td>
      </tr>
    ))
  )}
</tbody>
            </Table>
          </div>
        )}
      </div>
    </Col>
  );
};

export default DashboardHome2;
