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
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [searchColumn, setSearchColumn] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortByDateAsc, setSortByDateAsc] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);


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
      setRefreshing(true);
      const userInfo = await fetchUserInfo();
      if (!userInfo) return;
  
      const { companyName, role } = userInfo;
  
      let devicesData = [];
      if (companyName === "Gsn Soln") {
        const allDevicesRes = await axios.get('/api/devices');
        devicesData = allDevicesRes.data || [];
      } else if (!companyName || companyName.trim() === "") {
        setDevices([]);
        setFilteredSensorData([]);
        setSensorData([]);
        setLoading(false);
        return;
      } else {
        const deviceRes = await axios.get('/api/devices', { params: { companyName } });
        devicesData = deviceRes.data || [];
      }
  
      const sensorRes = await axios.get('/api/levelsensor');
      const sensorDataRaw = sensorRes.data || [];
  
      const deviceUids = devicesData.map(dev => dev.uid);
      const allowedUids = new Set(deviceUids);
  
      let filtered = [];

      if (companyName === "Gsn Soln") {
        filtered = sensorDataRaw;
      } else if (!companyName || companyName.trim() === "") {
        filtered = [];
      } else {
        filtered = sensorDataRaw.filter(s => allowedUids.has(s.uid));
      }
      
      setFilteredSensorData(filtered);
        
      setDevices(devicesData);
      setSensorData(sensorDataRaw);
      setFilteredSensorData(companyName === "Gsn Soln" ? sensorDataRaw : filtered);
      if (sensorDataRaw.length > 0) {
        console.log("📅 Example sensor date:", sensorDataRaw[0].D);
      }
      // Metrics
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

      setLastUpdated(new Date()); // store timestamp
      setRefreshing(false); // hide spinner
    } catch (err) {
      console.error("❌ Data fetching error:", err);
      setRefreshing(false);
      setLoading(false);
    }
  };
  

  useEffect(() => {
    const intervalId = setInterval(() => {
    fetchAll();
    }, 60000); // Auto refresh every 60 sec

    return () => clearInterval(intervalId);
  }, []);

  const displayedSensorData = filteredSensorData
  /* ─────────────────────────── SEARCH ─────────────────────────── */
  .filter((item) => {
    if (!searchTerm) return true;

    const lowerTerm = searchTerm.toLowerCase();

    if (searchColumn) {
      // ① catch undefined / null and convert to string safely
      const cell = item?.[searchColumn];
      return (cell ?? 'N/A').toString().toLowerCase().includes(lowerTerm);
    }

    return Object.values(item).some((val) =>
      (val ?? 'N/A').toString().toLowerCase().includes(lowerTerm)
    );
  })
  /* ───────────────────────────  SORT  ─────────────────────────── */
  .sort((a, b) => {
    const parseCustomDate = (str) => {
      // ② guard against null, undefined, wrong format
      if (typeof str !== 'string' || !str.includes(' ')) return null;

      const [datePart, timePart] = str.split(' ');
      const [day, month, year] = datePart.split('/').map(Number);
      const [hour, minute, second] = timePart.split(':').map(Number);

      const date = new Date(year, month - 1, day, hour, minute, second);
      return isNaN(date) ? null : date;          // ③ invalid date → null
    };

    const dateA = parseCustomDate(a.D);
    const dateB = parseCustomDate(b.D);

    // ④ Treat nulls as the “oldest” so they sort to the end
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    return sortByDateAsc ? dateA - dateB : dateB - dateA;
  });



  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main}>
      <div className="p-3 mt-2">
        <Row className="g-4">
          {role === 'superadmin'  && (
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

          {(role === 'superadmin') || role === 'admin' ? (
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

          {(role === 'superadmin') || role === 'admin' || role === 'user' ? (
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
        <div className="d-flex align-items-center justify-content-between">
  <h5 className="mb-0">Sensor Data Logs</h5>
  {lastUpdated && (
    <small className="text-muted d-flex align-items-center">
      Last updated:{" "}
      <span style={{ fontWeight: "bold", margin: "0 4px" }}>
        {lastUpdated.toLocaleTimeString()}
      </span>
      {refreshing && (
        <Spinner
          animation="border"
          variant="secondary"
          size="sm"
          style={{ marginLeft: '6px' }}
        />
      )}
    </small>
  )}
</div>


        {loading && (
          <div style={{
            position: 'absolute',
            top: '90%',
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
            <Row className="mb-3">
  <Col md={4}>
    <Form.Select
      value={searchColumn}
      onChange={(e) => setSearchColumn(e.target.value)}
      className="custom_input1"
    >
      <option value="">All Columns</option>
      <option value="D">Date</option>
      <option value="address">Location</option>
      <option value="vehicleNo">Vehicle Number</option>
      <option value="data">Data</option>
    </Form.Select>
  </Col>
  <Col md={8}>
    <Form.Control
      type="text"
      placeholder="Search..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="custom_input1"
    />
  </Col>
</Row>

            <Table striped bordered hover responsive>
  <thead>
    <tr>
      <th>
        <Form.Check
          type="checkbox"
          checked={selectAll}
          onChange={(e) => {
            const isChecked = e.target.checked;
            setSelectAll(isChecked);
            if (isChecked) {
              const allIds = filteredSensorData.map(item => item._id);
              setSelectedRows(allIds);
            } else {
              setSelectedRows([]);
            }
          }}
        />
      </th>
      <th onClick={() => setSortByDateAsc(!sortByDateAsc)} style={{ cursor: "pointer" }}>
  Date {sortByDateAsc ? "↑" : "↓"}
</th>
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
      displayedSensorData.map((item) => (
        <tr key={item._id}>
          <td>
            <Form.Check
              type="checkbox"
              checked={selectedRows.includes(item._id)}
              onChange={(e) => {
                const isChecked = e.target.checked;
                if (isChecked) {
                  setSelectedRows(prev => [...prev, item._id]);
                } else {
                  setSelectedRows(prev => prev.filter(id => id !== item._id));
                  setSelectAll(false); // uncheck header if one is deselected
                }
              }}
            />
          </td>
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
