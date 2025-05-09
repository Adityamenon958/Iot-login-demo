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

  const fetchDevices = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_BASE}/api/devices`);
      console.log("Devices API response:", res.data);
      
      if (Array.isArray(res.data)) {
        setDeviceData(res.data.data);
      } else {
        console.error("❌ Unexpected response format. Expected array, got:", res.data);
        setDeviceData([]); // fallback so UI doesn't crash
      }
  
      setLoading(false);
    } catch (err) {
      console.error("Devices API error:", err);
      setLoading(false);
      setDeviceData([]); // ensure fallback even if error
    }
  };
  

  useEffect(() => {
    // Fetch dashboard card data
    axios.get(`${import.meta.env.VITE_API_BASE}/api/dashboard`)
      .then(res => {
        console.log("Dashboard API response:", res.data); // Debugging log here
        setActiveDevices(res.data.activeDevices);
        setInactiveDevices(res.data.inactiveDevices);
        setAlarms(res.data.alarms);
      })
      .catch(err => {
        console.error("Dashboard API error:", err);
      });

    // Fetch device list for table
    fetchDevices();
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    subscription: '',
  });

  const handleChange = (e) => {
    console.log("Form data change:", e.target.name, e.target.value); // Log form data change
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Form submitted with data:", formData); // Log form data on submit
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_BASE}/api/devices`, formData);
      console.log("Device added ✅", res.data);

      // Optional: refresh the device list after adding
      await fetchDevices(); // If you already have a function for this

      // Reset form
      setFormData({ name: '', location: '', subscription: '' });
    } catch (err) {
      console.error("Error adding device ❌", err);
    }
  };

  const handleDelete = async (id) => {
    console.log("Attempting to delete device with ID:", id); // Log device ID on delete
    try {
      await axios.delete(`${import.meta.env.VITE_API_BASE}/api/devices/${id}`);
      console.log("Device deleted successfully");
      fetchDevices(); // Refresh data
    } catch (err) {
      console.error("❌ Delete error:", err.response?.data || err.message);
    }
  };

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
          <div>Loading...</div>
        ) : (
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th><Form.Check type="checkbox" disabled /> </th>
                <th>Device ID</th>
                <th>Device Name</th>
                <th>Location</th>
                <th>View Logs</th>
                <th>Subscription</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deviceData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center">No devices found</td>
                </tr>
              ) : (
                deviceData.map((device) => (
                  <tr key={device._id}>
                    <td><Form.Check type="checkbox" /> </td>
                    <td>{device._id}</td>
                    <td>{device.name}</td>
                    <td>{device.location}</td>
                    <td>
                      <Button variant="outline-primary" size="sm">
                        View Logs
                      </Button>
                    </td>
                    <td>{device.subscription}</td>
                    <td>
                      <Button onClick={() => handleDelete(device._id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border rounded shadow-sm mb-4">
        <h4>Add New Device</h4>
        <div className="mb-2">
          <input
            type="text"
            name="name"
            placeholder="Device Name"
            value={formData.name}
            onChange={handleChange}
            className="form-control"
            required
          />
        </div>
        <div className="mb-2">
          <input
            type="text"
            name="location"
            placeholder="Location"
            value={formData.location}
            onChange={handleChange}
            className="form-control"
            required
          />
        </div>
        <div className="mb-3">
          <select
            name="subscription"
            value={formData.subscription}
            onChange={handleChange}
            className="form-select"
            required
          >
            <option value="">Select Subscription</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary">Add Device</button>
      </form>
    </Col>
  );
};

export default DashboardHome;
