// DashboardHome2.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Col, Row, Card, Table, Form, Spinner } from 'react-bootstrap';
import styles from './MainContent.module.css';
import './MainContent.css';

const rowsPerPage = 9;        // 🔧 tweak any time

export default function DashboardHome2() {
  /* ─────────── state ─────────── */
  const [role,   setRole]   = useState('');
  const [companyName, setCompanyName] = useState('');

  const [sensorData, setSensorData] = useState([]);
  const [totalPages, setTotalPages]   = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const [searchColumn, setSearchColumn] = useState('');
  const [searchTerm,   setSearchTerm]   = useState('');
  const [sortAsc, setSortAsc] = useState(false);

  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [selectAll,     setSelectAll]   = useState(false);
  const [selectedRows,  setSelectedRows]= useState([]);

  /* Card metrics (unchanged piece of your code, shortened here) */
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [totalUsers,     setTotalUsers]     = useState(0);
  const [totalDevices,   setTotalDevices]   = useState(0);
  const [totalUsersByCompany,   setTotalUsersByCompany]   = useState(0);
  const [totalDevicesByCompany, setTotalDevicesByCompany] = useState(0);

  /* ─────────── helpers ─────────── */
  const fetchUserInfo = async () => {
    const res = await axios.get('/api/auth/userinfo', { withCredentials: true });
    setRole(res.data.role);
    setCompanyName(res.data.companyName);
    return res.data;
  };

  /* ---------------- SENSOR PAGE FETCH ---------------- */
  const fetchSensorPage = async (page = 1) => {
    setRefreshing(true);
    const res = await axios.get('/api/levelsensor', {
      withCredentials: true,
      params: {
        page,
        limit: rowsPerPage,
        search: searchTerm,
        column: searchColumn,
        sort: sortAsc ? 'asc' : 'desc'
      }
    });

    setSensorData(res.data.data);
    setTotalPages(Math.max(1, Math.ceil(res.data.total / rowsPerPage)));
    setLastUpdated(new Date());
    setRefreshing(false);
  };

  /* ---------------- METRICS (unchanged) ------------- */
  const fetchMetrics = async (info) => {
    const { role, companyName } = info;
    try {
      if (role === 'superadmin' && companyName === 'Gsn Soln') {
        const [cRes, uRes, dRes] = await Promise.all([
          axios.get('/api/companies/count'),
          axios.get('/api/users/count'),
          axios.get('/api/devices/count'),
        ]);
        setTotalCompanies(cRes.data.totalCompanies);
        setTotalUsers(uRes.data.totalUsers);
        setTotalDevices(dRes.data.totalDevices);
      } else if (role === 'admin') {
        const [uRes, dRes] = await Promise.all([
          axios.get('/api/users/count/by-company',   { params: { companyName } }),
          axios.get('/api/devices/count/by-company', { params: { companyName } }),
        ]);
        setTotalUsersByCompany(uRes.data.totalUsersByCompany);
        setTotalDevicesByCompany(dRes.data.totalDevicesByCompany);
      } else if (role === 'user') {
        const dRes = await axios.get('/api/devices/count/by-company', { params: { companyName } });
        setTotalDevicesByCompany(dRes.data.totalDevicesByCompany);
      }
    } catch (err) {
      console.error('Metric fetch error', err);
    }
  };

  /* ---------------- INITIAL LOAD ---------------- */
  useEffect(() => {
    (async () => {
      const info = await fetchUserInfo();
      await fetchMetrics(info);
      await fetchSensorPage(1);
      setLoading(false);
    })();
  }, []);

  /* ---------------- PARAM-CHANGE FETCH ------------- */
  useEffect(() => {
    /* debounce 400 ms so typing doesn’t spam */
    const t = setTimeout(() => fetchSensorPage(1), 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, searchColumn, sortAsc]);

  /* ------------- PAGE CHANGE ------------- */
  useEffect(() => { fetchSensorPage(currentPage); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPage]);

  /* ------------- AUTO-REFRESH every minute ---------- */
  useEffect(() => {
    const id = setInterval(() => fetchSensorPage(currentPage), 60000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  /* ─────────── UI ─────────── */
  if (loading) {
    return (
      <Col className={styles.main}>
        <div className="d-flex justify-content-center mt-5">
          <Spinner animation="border" />
        </div>
      </Col>
    );
  }

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main}>
      {/* --------- TOP METRIC CARDS (unchanged markup) ---------- */}
      <div className="p-3 mt-2">
        <Row className="g-4">
          {role === 'superadmin' && (
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
          {(role === 'superadmin' || role === 'admin') && (
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
          )}
          {(role === 'superadmin' || role === 'admin' || role === 'user') && (
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
          )}
        </Row>
      </div>

      {/* -------- SENSOR TABLE -------- */}
      <div className="mt-3 ms-3" style={{ position: 'relative', minHeight: 200 }}>
        <div className="d-flex align-items-center justify-content-between">
          <h5 className="mb-0">Sensor Data Logs</h5>
          {lastUpdated && (
            <small className="text-muted d-flex align-items-center">
              Last updated:&nbsp;<strong>{lastUpdated.toLocaleTimeString()}</strong>
              {refreshing && (
                <Spinner animation="border" variant="secondary" size="sm" className="ms-2" />
              )}
            </small>
          )}
        </div>

        <div className="tableScroll mt-3">
          {/* -------- SEARCH BAR -------- */}
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
                placeholder="Search…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="custom_input1"
              />
            </Col>
          </Row>

          {/* -------- TABLE -------- */}
          <Table striped bordered hover responsive className="db1_table">
            <thead>
              <tr>
                <th>
                  <Form.Check
                    checked={selectAll}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setSelectAll(isChecked);
                      setSelectedRows(isChecked ? sensorData.map((d) => d._id) : []);
                    }}
                  />
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => setSortAsc(!sortAsc)}>
                  Date {sortAsc ? '↑' : '↓'}
                </th>
                <th>Location</th>
                <th>Data</th>
                <th>Vehicle No.</th>
              </tr>
            </thead>
            <tbody>
              {sensorData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center">No sensor data found</td>
                </tr>
              ) : (
                sensorData.map((row) => (
                  <tr key={row._id}>
                    <td>
                      <Form.Check
                        checked={selectedRows.includes(row._id)}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setSelectedRows((prev) =>
                            isChecked ? [...prev, row._id] : prev.filter((id) => id !== row._id)
                          );
                          if (!isChecked) setSelectAll(false);
                        }}
                      />
                    </td>
                    <td>{row.D}</td>
                    <td>{row.address}</td>
                    <td>{Array.isArray(row.data) ? row.data.join(', ') : row.data} mm</td>
                    <td>{row.vehicleNo}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>

          {/* -------- PAGINATION -------- */}
          <div className="d-flex justify-content-center mt-3 me-3">
            <nav>
              <ul className="pagination modern-pagination">
                <li className={`page-item ${currentPage === 1 && 'disabled'}`}>
                  <button className="page-link" onClick={() => setCurrentPage((p) => p - 1)}>
                    Prev
                  </button>
                </li>

                {(() => {
                  const pages = [];
                  if (totalPages <= 5) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    if (currentPage <= 3) pages.push(1, 2, 3, 4, '…', totalPages);
                    else if (currentPage >= totalPages - 2)
                      pages.push(1, '…', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                    else pages.push(1, '…', currentPage - 1, currentPage, currentPage + 1, '…', totalPages);
                  }
                  return pages.map((pg, idx) => (
                    <li
                      key={idx}
                      className={`page-item ${pg === currentPage ? 'active' : ''} ${pg === '…' && 'disabled'}`}
                    >
                      {pg === '…' ? (
                        <span className="page-link">…</span>
                      ) : (
                        <button className="page-link" onClick={() => setCurrentPage(pg)}>
                          {pg}
                        </button>
                      )}
                    </li>
                  ));
                })()}

                <li className={`page-item ${currentPage === totalPages && 'disabled'}`}>
                  <button className="page-link" onClick={() => setCurrentPage((p) => p + 1)}>
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </Col>
  );
}
