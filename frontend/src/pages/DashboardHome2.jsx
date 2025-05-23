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

 

  useEffect(() => {
    const fetchAll = async () => {
      const storedRole = localStorage.getItem('role');
      const storedCompany = localStorage.getItem('companyName');
      setRole(storedRole);
      setCompanyName(storedCompany);
  
      // await fetchDashboardStats();
  
      try {
        const [deviceRes, sensorRes] = await Promise.all([
          axios.get('/api/devices', { params: { companyName: storedCompany } }),
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
  
        if (storedRole === 'superadmin' && storedCompany === 'Gsn Soln') {
          const [companyRes, userRes, deviceRes] = await Promise.all([
            axios.get('/api/companies/count'),
            axios.get('/api/users/count'),
            axios.get('/api/devices/count'),
          ]);
          setTotalCompanies(companyRes.data.totalCompanies);
          setTotalUsers(userRes.data.totalUsers);
          setTotalDevices(deviceRes.data.totalDevices);
          console.log("Superadmin stats:", companyRes.data, userRes.data, deviceRes.data);
        }

        if (storedRole === 'admin') {
          const [usersRes, devicesRes] = await Promise.all([
            axios.get('/api/users/count/by-company', {
              params: { companyName: storedCompany },
            }),
            axios.get('/api/devices/count/by-company', {
              params: { companyName: storedCompany },
            }),
          ]);
          setTotalUsersByCompany(usersRes.data.totalUsersByCompany);
          setTotalDevicesByCompany(devicesRes.data.totalDevicesByCompany);
        }

        if (storedRole === 'user') {
          const [devicesRes] = await Promise.all([
           
            axios.get('/api/devices/count/by-company', {
              params: { companyName: storedCompany },
            }),
          ]);
          setTotalDevicesByCompany(devicesRes.data.totalDevicesByCompany);
        }
  
        setLoading(false);
      } catch (err) {
        console.error("❌ Data fetching error:", err);
        setLoading(false);
      }
    };
  
    fetchAll();
  }, []);
  
  

  
  console.log("🧮 Final card values -> Total Devices:", totalDevices);


  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main}>
      <div className="p-3">
      <Row className="g-4">
  {/* Only show this card for superadmin */}
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

  {/* Users card */}
  {(role === 'superadmin' && companyName === 'Gsn Soln') || role === 'admin' ? (
    <Col xs={12} sm={4} md={4}>
      <Card className={`${styles.deviceCard} text-center`}>
        <Card.Body>
          <i className={`bi bi-people-fill text-secondary ${styles.deviceIcon}`}></i>
          <Card.Title className={styles.cardTitle}>Total Users</Card.Title>
          <div className={styles.metricNumber}>
            {role === 'superadmin'
              ? totalUsers
              : totalUsersByCompany}
          </div>
        </Card.Body>
      </Card>
    </Col>
  ) : null}

  {/* Devices card */}
  {(role === 'superadmin' && companyName === 'Gsn Soln') || role === 'admin' || role === 'user' ? (
    <Col xs={12} sm={4} md={4}>
      <Card className={`${styles.deviceCard} text-center`}>
        <Card.Body>
          <i className={`bi bi-hdd-stack-fill text-success ${styles.deviceIcon}`}></i>
          <Card.Title className={styles.cardTitle}>Total Devices</Card.Title>
          <div className={styles.metricNumber}>
            {role === 'superadmin'
              ? totalDevices
              : totalDevicesByCompany}
          </div>
        </Card.Body>
      </Card>
    </Col>
  ) : null}
</Row>

      </div>

      {/* Table Section */}
      <div className="mt-4" style={{ position: 'relative', minHeight: '200px' }}>
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
