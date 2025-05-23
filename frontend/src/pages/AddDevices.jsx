import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Col, Row, Form, Button, Table, Spinner, Modal } from 'react-bootstrap';
import styles from './MainContent.module.css';
import './MainContent.css';

export default function AddDevice() {
  const navigate = useNavigate();

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [companyName, setCompanyName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [location, setLocation] = useState('');
  const [frequency, setFrequency] = useState('');
  const [uid, setUid] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [searchColumn, setSearchColumn] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

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
    setLoading(true);
    const companyName = localStorage.getItem('companyName');
    try {
      const response = await axios.get('/api/devices', {
        params: { companyName }
      });
      setDevices(response.data);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyName && deviceId) {
      const prefix = companyName.split(" ").map(word => word[0]).join('').toUpperCase();
      setUid(`${prefix}-${deviceId}`);
    }
  }, [companyName, deviceId]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isDuplicate = devices.some(device => device.uid === uid);
    if (isDuplicate) {
      alert('Device with same UID already exists!');
      return;
    }

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
      fetchDevices();
      alert(response.data.message);
      setDeviceId('');
      setDeviceType('');
      setLocation('');
      setFrequency('');
      setShowModal(false);
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Failed to add device');
    }
  };

  const filteredDevices = devices.filter((dev) => {
    if (!searchTerm) return true;
    const lowerTerm = searchTerm.toLowerCase();

    if (searchColumn) {
      return dev[searchColumn]?.toString().toLowerCase().includes(lowerTerm);
    }

    return Object.values(dev).some(val =>
      val?.toString().toLowerCase().includes(lowerTerm)
    );
  });

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={`${styles.main} p-4`}>
      <Row className="justify-content-between d-flex align-items-start flex-column justify-content-evenly">
        <Col><h3>Device Management</h3></Col>
        <Col className='mt-3' xs="auto">
          <Button variant="success" onClick={() => setShowModal(true)} className='std_button'>
            Add Device
          </Button>
        </Col>
      </Row>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered className="custom_modal1">
        <Modal.Header className="border-0 px-4 pt-4 pb-0 d-flex justify-content-between align-items-center" closeButton>
          <Modal.Title>Add New Device</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="my-1">
              <Form.Label className="custom_label1">Company Name</Form.Label>
              <Form.Control className="custom_input1" type="text" value={companyName} disabled />
            </Form.Group>

            <Form.Group className="my-1">
              <Form.Label className="custom_label1">UID</Form.Label>
              <Form.Control className="custom_input1" type="text" value={uid} disabled />
            </Form.Group>

            <Form.Group className="my-1">
              <Form.Label className="custom_label1">Device ID</Form.Label>
              <Form.Control
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                required
                className="custom_input1"
              />
            </Form.Group>

            <Form.Group className="my-1">
              <Form.Label className="custom_label1">Device Type</Form.Label>
              <Form.Select
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value)}
                required
                className="custom_input1"
              >
                <option value="">Select type</option>
                <option value="Temperature Sensor">Temperature Sensor</option>
                <option value="Pressure Sensor">Pressure Sensor</option>
                <option value="Humidity Sensor">Humidity Sensor</option>
                <option value="Motion Detector">Motion Detector</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="my-1">
              <Form.Label className="custom_label1">Device Location</Form.Label>
              <Form.Control
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className="custom_input1"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="custom_label1">Frequency</Form.Label>
              <Form.Select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                required
                className="custom_input1"
              >
                <option value="">Select frequency</option>
                <option value="1s">1 sec</option>
                <option value="10s">10 sec</option>
                <option value="30s">30 sec</option>
                <option value="1m">1 min</option>
              </Form.Select>
            </Form.Group>

            <Button variant="primary" type="submit" className="w-100 signIn1 mb-2">
              Submit
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      <Row className="mt-4">
        <h4 className="mt-3">Existing Devices</h4>

        {/* Search Inputs */}
        <Row className="mb-3">
          <Col md={4}>
            <Form.Select
              value={searchColumn}
              onChange={(e) => setSearchColumn(e.target.value)}
              className="custom_input1"
            >
              <option value="">All Columns</option>
              <option value="uid">UID</option>
              <option value="deviceId">Device ID</option>
              <option value="deviceType">Type</option>
              <option value="location">Location</option>
              <option value="frequency">Frequency</option>
              <option value="companyName">Company</option>
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

        <div style={{ position: 'relative', minHeight: '250px' }}>
          {loading && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
              backgroundColor: 'rgba(255,255,255,0.85)',
              padding: '2rem',
              borderRadius: '0.5rem'
            }}>
              <Spinner animation="border" variant="primary" />
            </div>
          )}

          {!loading && (
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
                {filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center">No matching devices</td>
                  </tr>
                ) : (
                  filteredDevices.map((dev, index) => (
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
            </Table>
          )}
        </div>
      </Row>
    </Col>
  );
}
