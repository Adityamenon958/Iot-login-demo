// DashboardHome2.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Col, Row, Card, Table, Form, Spinner } from 'react-bootstrap';
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

  const [role, setRole] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalDevices, setTotalDevices] = useState(0);
  const [totalUsersByCompany, setTotalUsersByCompany] = useState(0);
  const [totalDevicesByCompany, setTotalDevicesByCompany] = useState(0);

  const fetchUserInfo = async () => {
    try {
      const res = await axios.get('/api/auth/userinfo', { withCredentials: true });
      setRole(res.data.role);
      setCompanyName(res.data.companyName);
      return res.data;
    } catch (err) {
      console.error("Failed to fetch user info:", err);
      return null;
    }
  };

  const fetchAll = async () => {
    try {
      const userInfo = await fetchUserInfo();
      if (!userInfo) return;

      const { companyName, role } = userInfo;

      const [deviceRes, sensorRes] = await Promise.all([
        axios.get('/api/devices', { params: { companyName } }),
        axios.get('/api/levelsensor')
      ]);

      const devicesData = deviceRes.data || [];
      const sensorDataRaw = sensorRes.data || [];

      const deviceUids = devicesData.map(dev => dev.uid);
      const allowedUids = new Set(deviceUids);
      const filtered = sensorDataRaw.filter(s => allowedUids.has(s.uid));

      setDevices(devicesData);
      setSensorData(sensorDataRaw);
      setFilteredSensorData(filtered);

      if (role === 'superadmin' && companyName === 'Gsn Soln') {
        const [companyRes, userRes, deviceRes] = await Promise.all([
          axios.get('/api/companies/count'),
          axios.get('/api/users/count'),
          axios.get('/api/devices/count'),
        ]);
        setTotalCompanies(companyRes.data.totalCompanies);
        setTotalUsers(userRes.data.totalUsers);
        setTotalDevices(deviceRes.data.totalDevices);
      }

      if (role === 'admin') {
        const [usersRes, devicesRes] = await Promise.all([
          axios.get('/api/users/count/by-company', { params: { companyName } }),
          axios.get('/api/devices/count/by-company', { params: { companyName } }),
        ]);
        setTotalUsersByCompany(usersRes.data.totalUsersByCompany);
        setTotalDevicesByCompany(devicesRes.data.totalDevicesByCompany);
      }

      if (role === 'user') {
        const devicesRes = await axios.get('/api/devices/count/by-company', {
          params: { companyName }
        });
        setTotalDevicesByCompany(devicesRes.data.totalDevicesByCompany);
      }

      setLoading(false);
    } catch (err) {
      console.error("❌ Data fetching error:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main}>
      <div className="p-3 mt-2">
        <Row className="g-4">
          {role === 'superadmin' && companyName === 'Gsn Soln' && (
            <Col xs={12} sm={4} md={4}>
              <Card className={`${styles.deviceCard} text-center`}>
                <Card.Body>
                  <i className={`bi bi-buildings-fill text-primary ${styles.deviceIcon}`}></i>
                  <Card.Title className={styles.cardTitle}>Total Companies</Card.Title>
                  <div className={styles.metricNumber}>{totalCompanies}</div>
                </Card.Body>
              </Card>
            </Col>
          )}

          {(role === 'superadmin' && companyName === 'Gsn Soln') || role === 'admin' ? (
            <Col xs={12} sm={4} md={4}>
              <Card className={`${styles.deviceCard} text-center`}>
                <Card.Body>
                  <i className={`bi bi-people-fill text-secondary ${styles.deviceIcon}`}></i>
                  <Card.Title className={styles.cardTitle}>Total Users</Card.Title>
                  <div className={styles.metricNumber}>
                    {role === 'superadmin' ? totalUsers : totalUsersByCompany}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ) : null}

          {(role === 'superadmin' && companyName === 'Gsn Soln') || role === 'admin' || role === 'user' ? (
            <Col xs={12} sm={4} md={4}>
              <Card className={`${styles.deviceCard} text-center`}>
                <Card.Body>
                  <i className={`bi bi-hdd-stack-fill text-success ${styles.deviceIcon}`}></i>
                  <Card.Title className={styles.cardTitle}>Total Devices</Card.Title>
                  <div className={styles.metricNumber}>
                    {role === 'superadmin' ? totalDevices : totalDevicesByCompany}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ) : null}
        </Row>
      </div>

      {/* Sensor Data Table */}
      <div className="mt-3 ms-3" style={{ position: 'relative', minHeight: '200px' }}>
        <h5>Sensor Data Logs</h5>

        {loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            backgroundColor: 'rgba(255,255,255,0.8)',
            padding: '2rem',
            borderRadius: '0.5rem'
          }}>
            <Spinner animation="border" role="status" variant="primary" />
          </div>
        )}

        {!loading && (
          <div className='tableScroll'>
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
