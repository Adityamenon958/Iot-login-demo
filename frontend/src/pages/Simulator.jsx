import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Row, 
  Col, 
  Card, 
  Form, 
  Button, 
  Table, 
  Alert, 
  Spinner,
  Badge,
  Modal,
  InputGroup
} from 'react-bootstrap';
import { 
  Play, 
  Square, 
  Plus, 
  RefreshCw, 
  Edit3, 
  Trash2,
  MapPin,
  Clock,
  Settings,
  Activity
} from 'lucide-react';
import axios from 'axios';

export default function Simulator() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [formData, setFormData] = useState({
    craneCompany: 'Gsn Soln',
    DeviceID: '',
    latitude: '19.045980',
    longitude: '73.027397',
    state: 'working',
    frequencyMinutes: 1,
    padTimestamp: true,
    profile: 'A',
    jitter: false
  });
  
  // Loading states
  const [addingDevice, setAddingDevice] = useState(false);
  const [startingDevice, setStartingDevice] = useState('');
  const [stoppingDevice, setStoppingDevice] = useState('');
  const [updatingDevice, setUpdatingDevice] = useState('');

  // ✅ Fetch devices on component mount
  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get('/api/sim/list', { withCredentials: true });
      setDevices(response.data.devices || []);
    } catch (err) {
      console.error('❌ Failed to fetch devices:', err);
      setError('Failed to fetch devices. Make sure you have superadmin access.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddDevice = async () => {
    try {
      setAddingDevice(true);
      setError('');
      
      const response = await axios.post('/api/sim/add', formData, { withCredentials: true });
      
      if (response.data.success) {
        setSuccess(`Device ${formData.DeviceID} added successfully!`);
        setShowAddModal(false);
        setFormData({
          craneCompany: 'Gsn Soln',
          DeviceID: '',
          latitude: '19.045980',
          longitude: '73.027397',
          state: 'working',
          frequencyMinutes: 1,
          padTimestamp: true,
          profile: 'A',
          jitter: false
        });
        fetchDevices();
      }
    } catch (err) {
      console.error('❌ Failed to add device:', err);
      setError(err.response?.data?.error || 'Failed to add device');
    } finally {
      setAddingDevice(false);
    }
  };

  const handleStartDevice = async (deviceId) => {
    try {
      setStartingDevice(deviceId);
      setError('');
      
      const response = await axios.post('/api/sim/start', { DeviceID: deviceId }, { withCredentials: true });
      
      if (response.data.success) {
        setSuccess(`Device ${deviceId} started successfully!`);
        fetchDevices();
      }
    } catch (err) {
      console.error('❌ Failed to start device:', err);
      setError(err.response?.data?.error || 'Failed to start device');
    } finally {
      setStartingDevice('');
    }
  };

  const handleStopDevice = async (deviceId) => {
    try {
      setStoppingDevice(deviceId);
      setError('');
      
      const response = await axios.post('/api/sim/stop', { DeviceID: deviceId }, { withCredentials: true });
      
      if (response.data.success) {
        setSuccess(`Device ${deviceId} stopped successfully!`);
        fetchDevices();
      }
    } catch (err) {
      console.error('❌ Failed to stop device:', err);
      setError(err.response?.data?.error || 'Failed to stop device');
    } finally {
      setStoppingDevice('');
    }
  };

  const handleEditDevice = (device) => {
    setEditingDevice(device);
    setFormData({
      craneCompany: device.craneCompany,
      DeviceID: device.DeviceID,
      latitude: device.latitude.toString(),
      longitude: device.longitude.toString(),
      state: device.state,
      frequencyMinutes: device.frequencyMinutes,
      padTimestamp: device.padTimestamp,
      profile: device.profile,
      jitter: device.jitter
    });
    setShowEditModal(true);
  };

  const handleUpdateDevice = async () => {
    try {
      setUpdatingDevice(editingDevice.DeviceID);
      setError('');
      
      const response = await axios.post('/api/sim/update', {
        DeviceID: editingDevice.DeviceID,
        ...formData
      }, { withCredentials: true });
      
      if (response.data.success) {
        setSuccess(`Device ${editingDevice.DeviceID} updated successfully!`);
        setShowEditModal(false);
        setEditingDevice(null);
        fetchDevices();
      }
    } catch (err) {
      console.error('❌ Failed to update device:', err);
      setError(err.response?.data?.error || 'Failed to update device');
    } finally {
      setUpdatingDevice('');
    }
  };

  const handleRemoveDevice = async (deviceId) => {
    if (!window.confirm(`Are you sure you want to remove device ${deviceId}?`)) {
      return;
    }
    
    try {
      setError('');
      
      const response = await axios.delete(`/api/sim/remove/${deviceId}`, { withCredentials: true });
      
      if (response.data.success) {
        setSuccess(`Device ${deviceId} removed successfully!`);
        fetchDevices();
      }
    } catch (err) {
      console.error('❌ Failed to remove device:', err);
      setError(err.response?.data?.error || 'Failed to remove device');
    }
  };

  const getStatusBadge = (device) => {
    if (device.isRunning) {
      return <Badge bg="success">Running</Badge>;
    }
    return <Badge bg="secondary">Stopped</Badge>;
  };

  const getStateBadge = (state) => {
    const variants = {
      working: 'success',
      idle: 'info',
      maintenance: 'warning'
    };
    return <Badge bg={variants[state] || 'secondary'}>{state}</Badge>;
  };

  if (loading) {
    return (
      <Container fluid className="mt-4">
        <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
          <Spinner animation="border" variant="primary" />
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="mt-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <h2 className="d-flex align-items-center">
            <Activity className="me-2" size={28} />
            Data Simulator
          </h2>
          <p className="text-muted">
            Generate simulated crane data for testing. Add devices, configure parameters, and start/stop data flow.
          </p>
        </Col>
        <Col xs="auto">
          <Button 
            variant="primary" 
            onClick={() => setShowAddModal(true)}
            className="d-flex align-items-center"
          >
            <Plus size={20} className="me-2" />
            Add Simulated Crane
          </Button>
        </Col>
      </Row>

      {/* Alerts */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Devices Table */}
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Simulated Devices</h5>
          <Button 
            variant="outline-secondary" 
            size="sm" 
            onClick={fetchDevices}
            className="d-flex align-items-center"
          >
            <RefreshCw size={16} className="me-2" />
            Refresh
          </Button>
        </Card.Header>
        <Card.Body>
          {devices.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted">No simulated devices found.</p>
              <p className="text-muted">Click "Add Simulated Crane" to get started.</p>
            </div>
          ) : (
            <Table responsive striped hover>
              <thead>
                <tr>
                  <th>Device ID</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>State</th>
                  <th>Frequency</th>
                  <th>Profile</th>
                  <th>Options</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.DeviceID}>
                    <td>
                      <strong>{device.DeviceID}</strong>
                    </td>
                    <td>{device.craneCompany}</td>
                    <td>
                      <small>
                        <MapPin size={14} className="me-1" />
                        {device.latitude.toFixed(6)}, {device.longitude.toFixed(6)}
                      </small>
                    </td>
                    <td>{getStateBadge(device.state)}</td>
                    <td>
                      <small>
                        <Clock size={14} className="me-1" />
                        {device.frequencyMinutes}m
                      </small>
                    </td>
                    <td>
                      <Badge bg="outline-secondary">{device.profile}</Badge>
                    </td>
                    <td>
                      <div className="d-flex flex-column gap-1">
                        <small>
                          {device.padTimestamp ? '✅' : '❌'} Pad TS
                        </small>
                        <small>
                          {device.jitter ? '✅' : '❌'} Jitter
                        </small>
                      </div>
                    </td>
                    <td>{getStatusBadge(device)}</td>
                    <td>
                      <div className="d-flex gap-1">
                        {device.isRunning ? (
                          <Button
                            size="sm"
                            variant="warning"
                            onClick={() => handleStopDevice(device.DeviceID)}
                            disabled={stoppingDevice === device.DeviceID}
                          >
                            {stoppingDevice === device.DeviceID ? (
                              <Spinner animation="border" size="sm" />
                            ) : (
                              <Square size={16} />
                            )}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => handleStartDevice(device.DeviceID)}
                            disabled={startingDevice === device.DeviceID}
                          >
                            {startingDevice === device.DeviceID ? (
                              <Spinner animation="border" size="sm" />
                            ) : (
                              <Play size={16} />
                            )}
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => handleEditDevice(device)}
                        >
                          <Edit3 size={16} />
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => handleRemoveDevice(device.DeviceID)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Add Device Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Add Simulated Crane</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Company Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="craneCompany"
                    value={formData.craneCompany}
                    onChange={handleInputChange}
                    placeholder="Gsn Soln"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Device ID *</Form.Label>
                  <Form.Control
                    type="text"
                    name="DeviceID"
                    value={formData.DeviceID}
                    onChange={handleInputChange}
                    placeholder="CRANE005"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Latitude *</Form.Label>
                  <Form.Control
                    type="number"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleInputChange}
                    step="0.000001"
                    placeholder="19.045980"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Longitude *</Form.Label>
                  <Form.Control
                    type="number"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleInputChange}
                    step="0.000001"
                    placeholder="73.027397"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Initial State *</Form.Label>
                  <Form.Select
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="working">Working</option>
                    <option value="idle">Idle</option>
                    <option value="maintenance">Maintenance</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Frequency (minutes) *</Form.Label>
                  <Form.Select
                    name="frequencyMinutes"
                    value={formData.frequencyMinutes}
                    onChange={handleInputChange}
                    required
                  >
                    <option value={1}>1 minute</option>
                    <option value={2}>2 minutes</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Profile</Form.Label>
                  <Form.Select
                    name="profile"
                    value={formData.profile}
                    onChange={handleInputChange}
                  >
                    <option value="A">Profile A (Default)</option>
                    <option value="B">Profile B (Alternate)</option>
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Profile A: working=[0,1], maintenance=[1,0], idle=[0,0]<br/>
                    Profile B: working=[1,0], maintenance=[0,1], idle=[0,0]
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Options</Form.Label>
                  <div>
                    <Form.Check
                      type="checkbox"
                      name="padTimestamp"
                      checked={formData.padTimestamp}
                      onChange={handleInputChange}
                      label="Pad Timestamp (add 3 spaces)"
                    />
                    <Form.Check
                      type="checkbox"
                      name="jitter"
                      checked={formData.jitter}
                      onChange={handleInputChange}
                      label="GPS Jitter (±0.0002)"
                    />
                  </div>
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAddDevice}
            disabled={addingDevice || !formData.DeviceID}
          >
            {addingDevice ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Adding...
              </>
            ) : (
              'Add Device'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Device Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Device: {editingDevice?.DeviceID}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Company Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="craneCompany"
                    value={formData.craneCompany}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Device ID</Form.Label>
                  <Form.Control
                    type="text"
                    name="DeviceID"
                    value={formData.DeviceID}
                    disabled
                    className="bg-light"
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Latitude</Form.Label>
                  <Form.Control
                    type="number"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleInputChange}
                    step="0.000001"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Longitude</Form.Label>
                  <Form.Control
                    type="number"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleInputChange}
                    step="0.000001"
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>State</Form.Label>
                  <Form.Select
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                  >
                    <option value="working">Working</option>
                    <option value="idle">Idle</option>
                    <option value="maintenance">Maintenance</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Frequency (minutes)</Form.Label>
                  <Form.Select
                    name="frequencyMinutes"
                    value={formData.frequencyMinutes}
                    onChange={handleInputChange}
                  >
                    <option value={1}>1 minute</option>
                    <option value={2}>2 minutes</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Profile</Form.Label>
                  <Form.Select
                    name="profile"
                    value={formData.profile}
                    onChange={handleInputChange}
                  >
                    <option value="A">Profile A</option>
                    <option value="B">Profile B</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Options</Form.Label>
                  <div>
                    <Form.Check
                      type="checkbox"
                      name="padTimestamp"
                      checked={formData.padTimestamp}
                      onChange={handleInputChange}
                      label="Pad Timestamp"
                    />
                    <Form.Check
                      type="checkbox"
                      name="jitter"
                      checked={formData.jitter}
                      onChange={handleInputChange}
                      label="GPS Jitter"
                    />
                  </div>
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleUpdateDevice}
            disabled={updatingDevice}
          >
            {updatingDevice ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Updating...
              </>
            ) : (
              'Update Device'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Info Card */}
      <Card className="mt-4">
        <Card.Header>
          <h6 className="mb-0">
            <Settings size={20} className="me-2" />
            Important Notes
          </h6>
        </Card.Header>
        <Card.Body>
          <div className="row">
            <div className="col-md-6">
              <h6>📋 Device Allow-List Requirement</h6>
              <p className="text-muted small">
                To see simulated cranes in your dashboard (maps, charts, overview), you must add the DeviceID to the <strong>Device</strong> collection first.
              </p>
              <p className="text-muted small">
                Example Device document:<br/>
                <code>
                  {`{
  companyName: "Gsn Soln",
  deviceId: "CRANE005", 
  deviceType: "crane",
  uid: "GS-CRANE005"
}`}
                </code>
              </p>
            </div>
            <div className="col-md-6">
              <h6>🔧 Simulator Features</h6>
              <ul className="text-muted small">
                <li>Exact payload format matching your gateway</li>
                <li>Configurable frequency: 1, 2, 5, 10, 15, 30 minutes</li>
                <li>GPS jitter simulation (±0.0002)</li>
                <li>Two profile mappings for state interpretation</li>
                <li>Timestamp padding option (3 spaces)</li>
                <li>Real-time start/stop control</li>
              </ul>
            </div>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}
