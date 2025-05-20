import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Col,Row, Form, Button, Table } from 'react-bootstrap';
import styles from './MainContent.module.css';
import './MainContent.css';

export default function AddDevice() {
  const navigate = useNavigate();
//   For Storing Devices from db
  const [devices, setDevices] = useState([]);

  const [companyName, setCompanyName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [location, setLocation] = useState('');
  const [frequency, setFrequency] = useState('');
  const [uid, setUid] = useState('');

  // Role check
  useEffect(() => {
    const role = localStorage.getItem('role');
    const company = localStorage.getItem('companyName');

    const isAuthorized =
      role === "admin" || (role === "superadmin" && company === "Gsn Soln");

    if (!isAuthorized) {
      navigate('/dashboard');
      console.log("Unauthorized access");
    }

    setCompanyName(company || '');
    fetchDevices();

  }, [navigate]);

  
  const fetchDevices = async () => {
    const companyName = localStorage.getItem('companyName'); // get from storage
  
    try {
      const response = await axios.get('/api/devices', {
        params: { companyName } // send it as query param
      });
      setDevices(response.data);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };
  

  // UID generation
  useEffect(() => {
    if (companyName && deviceId) {
      const prefix = companyName.split(" ").map(word => word[0]).join('').toUpperCase(); // GS
      setUid(`${prefix}-${deviceId}`);
    }
  }, [companyName, deviceId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    // Check for duplicate UID
    const isDuplicate = devices.some(device => device.uid === uid);
    if (isDuplicate) {
      alert('Device with same UID already exists!');
      return; // Stop submission
    }
  
    // Prepare data to send
    const formData = {
      companyName,
      uid,
      deviceId,
      deviceType,
      location,
      frequency,
    };
  
    try {
      const response = await axios.post('/api/devices', formData);
      fetchDevices(); // Refresh the device list
      alert(response.data.message);
  
      // Reset fields after successful add
      setDeviceId('');
      setDeviceType('');
      setLocation('');
      setFrequency('');
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Failed to add device');
    }
  };
  
  

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={`${styles.main} p-4`}>
        <Row>
      <h3>Add New Device</h3>
      <Form onSubmit={handleSubmit} className="mt-4">

        <Form.Group className="mb-3">
          <Form.Label>Company Name</Form.Label>
          <Form.Control className="custom_input" type="text" value={companyName} disabled />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>UID</Form.Label>
          <Form.Control className="custom_input" type="text" value={uid} disabled />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Device ID</Form.Label>
          <Form.Control
            type="text"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            required
            className="custom_input"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Device Type</Form.Label>
          <Form.Select
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value)}
            required
            className="custom_input"
          >
            <option value="">Select type</option>
            <option value="Temperature Sensor">Temperature Sensor</option>
            <option value="Pressure Sensor">Pressure Sensor</option>
            <option value="Humidity Sensor">Humidity Sensor</option>
            <option value="Motion Detector">Motion Detector</option>
          </Form.Select>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Device Location</Form.Label>
          <Form.Control
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            className="custom_input"
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>Frequency</Form.Label>
          <Form.Select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            required
            className="custom_input"
          >
            <option value="">Select frequency</option>
            <option value="1s">1 sec</option>
            <option value="10s">10 sec</option>
            <option value="30s">30 sec</option>
            <option value="1m">1 min</option>
          </Form.Select>
        </Form.Group>

        <Button variant="primary" type="submit" className="custom_AddBtn">
          Add Device
        </Button>
      </Form>
      </Row>
      <Row className='mt-4'><h4 className="mt-5">Existing Devices</h4>
      <Table striped bordered hover responsive>
  <thead>
    <tr>
      <th>UID</th>
      <th>Device ID</th>
      <th>Type</th>
      <th>Location</th>
      <th>Frequency</th>
      <th>Company</th>
    </tr>
  </thead>
  <tbody>
    {devices.length === 0 ? (
      <tr>
        <td colSpan="6" className="text-center">No devices found</td>
      </tr>
    ) : (
      devices.map((dev, index) => (
        <tr key={index}>
          <td>{dev.uid}</td>
          <td>{dev.deviceId}</td>
          <td>{dev.deviceType}</td>
          <td>{dev.location}</td>
          <td>{dev.frequency}</td>
          <td>{dev.companyName}</td>
        </tr>
      ))
    )}
  </tbody>
</Table></Row>
    </Col>
  );
}
