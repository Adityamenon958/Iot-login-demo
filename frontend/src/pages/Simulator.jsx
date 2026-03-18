import React, { useState, useEffect, useMemo } from 'react';
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
  Activity,
  Building2,
  ArrowUpDown,
  Sliders,
} from 'lucide-react';
import axios from 'axios';

// ✅ Default form values
const defaultCraneForm = {
  craneCompany: 'Gsn Soln',
  DeviceID: '',
  latitude: '19.045980',
  longitude: '73.027397',
  state: 'working',
  frequencyMinutes: 1,
  padTimestamp: true,
  profile: 'A',
  jitter: false,
};

const defaultElevatorForm = {
  elevatorCompany: 'Gsn Soln',
  DeviceID: '',
  location: 'Building A – Lobby',
  state: 'working',
  frequencyMinutes: 1,
};

export default function Simulator() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showAddCraneModal, setShowAddCraneModal] = useState(false);
  const [showAddElevatorModal, setShowAddElevatorModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideDevice, setOverrideDevice] = useState(null);
  const [overrideForm, setOverrideForm] = useState({
    overrideReg65: '',
    overrideReg66: '',
    overrideErrorCode: '',
    useComputed: false,
    reg66Preset: 'auto', // 'auto' | 'normal' | 'maintenance' | 'outOfService' | 'custom'
  });
  const [savingOverride, setSavingOverride] = useState(false);

  const [craneFormData, setCraneFormData] = useState(defaultCraneForm);
  const [elevatorFormData, setElevatorFormData] = useState(defaultElevatorForm);
  const [editFormData, setEditFormData] = useState({ ...defaultCraneForm });

  const [addingDevice, setAddingDevice] = useState(false);
  const [startingDevice, setStartingDevice] = useState('');
  const [stoppingDevice, setStoppingDevice] = useState('');
  const [updatingDevice, setUpdatingDevice] = useState('');

  const craneDevices = useMemo(() => devices.filter((d) => (d.deviceType || 'crane') === 'crane'), [devices]);
  const elevatorDevices = useMemo(() => devices.filter((d) => d.deviceType === 'elevator'), [devices]);

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

  const handleCraneInput = (e) => {
    const { name, value, type, checked } = e.target;
    setCraneFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };
  const handleElevatorInput = (e) => {
    const { name, value, type, checked } = e.target;
    setElevatorFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };
  const handleEditInput = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleAddCrane = async () => {
    try {
      setAddingDevice(true);
      setError('');
      const response = await axios.post('/api/sim/add', craneFormData, { withCredentials: true });
      if (response.data.success) {
        setSuccess(`Crane ${craneFormData.DeviceID} added successfully!`);
        setShowAddCraneModal(false);
        setCraneFormData(defaultCraneForm);
        fetchDevices();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add crane');
    } finally {
      setAddingDevice(false);
    }
  };

  const handleAddElevator = async () => {
    try {
      setAddingDevice(true);
      setError('');
      const payload = {
        deviceType: 'elevator',
        elevatorCompany: elevatorFormData.elevatorCompany,
        DeviceID: elevatorFormData.DeviceID,
        location: elevatorFormData.location,
        state: elevatorFormData.state,
        frequencyMinutes: Number(elevatorFormData.frequencyMinutes),
      };
      const response = await axios.post('/api/sim/add', payload, { withCredentials: true });
      if (response.data.success) {
        setSuccess(`Elevator ${elevatorFormData.DeviceID} added successfully!`);
        setShowAddElevatorModal(false);
        setElevatorFormData(defaultElevatorForm);
        fetchDevices();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add elevator');
    } finally {
      setAddingDevice(false);
    }
  };

  const handleStartDevice = async (deviceId) => {
    try {
      setStartingDevice(deviceId);
      setError('');
      await axios.post('/api/sim/start', { DeviceID: deviceId }, { withCredentials: true });
      setSuccess(`Device ${deviceId} started`);
      fetchDevices();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start');
    } finally {
      setStartingDevice('');
    }
  };

  const handleStopDevice = async (deviceId) => {
    try {
      setStoppingDevice(deviceId);
      setError('');
      await axios.post('/api/sim/stop', { DeviceID: deviceId }, { withCredentials: true });
      setSuccess(`Device ${deviceId} stopped`);
      fetchDevices();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to stop');
    } finally {
      setStoppingDevice('');
    }
  };

  const handleEditDevice = (device) => {
    setEditingDevice(device);
    const isElevator = device.deviceType === 'elevator';
    if (isElevator) {
      setEditFormData({
        elevatorCompany: device.craneCompany || device.name,
        DeviceID: device.DeviceID,
        location: device.location || '',
        state: device.state,
        frequencyMinutes: device.frequencyMinutes,
      });
    } else {
      setEditFormData({
        craneCompany: device.craneCompany || device.name,
        DeviceID: device.DeviceID,
        latitude: (device.latitude != null ? device.latitude : 0).toString(),
        longitude: (device.longitude != null ? device.longitude : 0).toString(),
        state: device.state,
        frequencyMinutes: device.frequencyMinutes,
        padTimestamp: device.padTimestamp,
        profile: device.profile || 'A',
        jitter: device.jitter,
      });
    }
    setShowEditModal(true);
  };

  const handleUpdateDevice = async () => {
    if (!editingDevice) return;
    try {
      setUpdatingDevice(editingDevice.DeviceID);
      setError('');
      const isElevator = editingDevice.deviceType === 'elevator';
      const payload = {
        DeviceID: editingDevice.DeviceID,
        ...(isElevator
          ? {
              elevatorCompany: editFormData.elevatorCompany,
              location: editFormData.location,
              state: editFormData.state,
              frequencyMinutes: Number(editFormData.frequencyMinutes),
            }
          : {
              craneCompany: editFormData.craneCompany,
              latitude: editFormData.latitude,
              longitude: editFormData.longitude,
              state: editFormData.state,
              frequencyMinutes: Number(editFormData.frequencyMinutes),
              padTimestamp: editFormData.padTimestamp,
              profile: editFormData.profile,
              jitter: editFormData.jitter,
            }),
      };
      await axios.post('/api/sim/update', payload, { withCredentials: true });
      setSuccess(`Device ${editingDevice.DeviceID} updated`);
      setShowEditModal(false);
      setEditingDevice(null);
      fetchDevices();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update');
    } finally {
      setUpdatingDevice('');
    }
  };

  const handleRemoveDevice = async (deviceId) => {
    if (!window.confirm(`Remove device ${deviceId}?`)) return;
    try {
      setError('');
      await axios.delete(`/api/sim/remove/${deviceId}`, { withCredentials: true });
      setSuccess(`Device ${deviceId} removed`);
      fetchDevices();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove');
    }
  };

  const handleOpenOverride = (device) => {
    setOverrideDevice(device);
    // Infer preset from existing overrideReg66 if present, else auto
    let reg66Preset = 'auto';
    if (device.overrideReg66 != null) {
      const val = Number(device.overrideReg66);
      // Match the same constants used in server.js buildElevatorPayload
      const normalVal = 4872;     // working: In Service + Comm Normal + Automatic + Normal Power
      const maintenanceVal = 1024; // maintenance: Maintenance ON
      const outOfServiceVal = 0;   // idle: all bits 0

      if (val === normalVal) {
        reg66Preset = 'normal';
      } else if (val === maintenanceVal) {
        reg66Preset = 'maintenance';
      } else if (val === outOfServiceVal) {
        reg66Preset = 'outOfService';
      } else {
        reg66Preset = 'custom';
      }
    }
    setOverrideForm({
      overrideReg65: device.overrideReg65 != null ? String(device.overrideReg65) : '',
      overrideReg66: device.overrideReg66 != null ? String(device.overrideReg66) : '',
      overrideErrorCode: device.overrideErrorCode || '',
      useComputed: false,
      reg66Preset,
    });
    setShowOverrideModal(true);
  };

  const handleOverrideInput = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'reg66Preset') {
      const preset = value;
      setOverrideForm((prev) => {
        // Map presets to concrete Reg66 values (or blank/auto)
        let nextOverrideReg66 = prev.overrideReg66;
        if (preset === 'auto') {
          nextOverrideReg66 = '';
        } else if (preset === 'normal') {
          // Normal: In Service + Comm Normal + Automatic + Normal Power
          // Use same constant as backend (server.js buildElevatorPayload)
          nextOverrideReg66 = String(4872);
        } else if (preset === 'maintenance') {
          // Maintenance: Maintenance ON
          nextOverrideReg66 = String(1024);
        } else if (preset === 'outOfService') {
          // Out of service: all bits 0
          nextOverrideReg66 = '0';
        } else if (preset === 'custom') {
          // Keep whatever user typed before
          nextOverrideReg66 = prev.overrideReg66;
        }
        return {
          ...prev,
          reg66Preset: preset,
          overrideReg66: nextOverrideReg66,
        };
      });
      return;
    }
    setOverrideForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSaveOverride = async () => {
    if (!overrideDevice) return;
    try {
      setSavingOverride(true);
      setError('');
      const payload = {
        DeviceID: overrideDevice.DeviceID,
        // If useComputed is true, clear all overrides
        overrideReg65: overrideForm.useComputed ? null : (overrideForm.overrideReg65 === '' ? null : overrideForm.overrideReg65),
        overrideReg66:
          overrideForm.useComputed || overrideForm.reg66Preset === 'auto'
            ? null
            : (overrideForm.overrideReg66 === '' ? null : overrideForm.overrideReg66),
        overrideErrorCode: overrideForm.useComputed ? null : (overrideForm.overrideErrorCode === '' ? null : overrideForm.overrideErrorCode),
      };
      await axios.post('/api/sim/elevator-override', payload, { withCredentials: true });
      setSuccess(`Live override updated for ${overrideDevice.DeviceID}. Next tick will use ${overrideForm.useComputed ? 'computed' : 'your'} values.`);
      setShowOverrideModal(false);
      setOverrideDevice(null);
      fetchDevices();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save override');
    } finally {
      setSavingOverride(false);
    }
  };

  const getStatusBadge = (device) =>
    device.isRunning ? <Badge bg="success">Running</Badge> : <Badge bg="secondary">Stopped</Badge>;

  const getStateBadge = (state) => {
    const v = { working: 'success', idle: 'info', maintenance: 'warning' };
    return <Badge bg={v[state] || 'secondary'}>{state}</Badge>;
  };

  const ActionButtons = ({ device }) => (
    <div className="d-flex gap-1">
      {device.isRunning ? (
        <Button size="sm" variant="warning" onClick={() => handleStopDevice(device.DeviceID)} disabled={stoppingDevice === device.DeviceID}>
          {stoppingDevice === device.DeviceID ? <Spinner animation="border" size="sm" /> : <Square size={16} />}
        </Button>
      ) : (
        <Button size="sm" variant="success" onClick={() => handleStartDevice(device.DeviceID)} disabled={startingDevice === device.DeviceID}>
          {startingDevice === device.DeviceID ? <Spinner animation="border" size="sm" /> : <Play size={16} />}
        </Button>
      )}
      <Button size="sm" variant="outline-primary" onClick={() => handleEditDevice(device)}>
        <Edit3 size={16} />
      </Button>
      <Button size="sm" variant="outline-danger" onClick={() => handleRemoveDevice(device.DeviceID)}>
        <Trash2 size={16} />
      </Button>
    </div>
  );

  const ElevatorActionButtons = ({ device }) => (
    <div className="d-flex flex-wrap gap-1 align-items-center">
      <Button size="sm" variant="outline-info" onClick={() => handleOpenOverride(device)} title="Set Reg65, Reg66, Error code for next tick">
        <Sliders size={16} className="me-1" />
        Set values
      </Button>
      {device.isRunning ? (
        <Button size="sm" variant="warning" onClick={() => handleStopDevice(device.DeviceID)} disabled={stoppingDevice === device.DeviceID}>
          {stoppingDevice === device.DeviceID ? <Spinner animation="border" size="sm" /> : <Square size={16} />}
        </Button>
      ) : (
        <Button size="sm" variant="success" onClick={() => handleStartDevice(device.DeviceID)} disabled={startingDevice === device.DeviceID}>
          {startingDevice === device.DeviceID ? <Spinner animation="border" size="sm" /> : <Play size={16} />}
        </Button>
      )}
      <Button size="sm" variant="outline-primary" onClick={() => handleEditDevice(device)}><Edit3 size={16} /></Button>
      <Button size="sm" variant="outline-danger" onClick={() => handleRemoveDevice(device.DeviceID)}><Trash2 size={16} /></Button>
    </div>
  );

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
      <Row className="mb-4">
        <Col>
          <h2 className="d-flex align-items-center">
            <Activity className="me-2" size={28} />
            Data Simulator
          </h2>
          <p className="text-muted">
            Generate simulated crane or elevator data for testing. Two sections: Cranes and Elevators.
          </p>
        </Col>
        <Col xs="auto">
          <Button variant="outline-primary" className="me-2" onClick={() => setShowAddCraneModal(true)}>
            <Plus size={18} className="me-1" />
            Add Crane
          </Button>
          <Button variant="primary" onClick={() => setShowAddElevatorModal(true)}>
            <Plus size={18} className="me-1" />
            Add Elevator
          </Button>
        </Col>
      </Row>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      {/* ---------- Section 1: Crane Simulator ---------- */}
      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0 d-flex align-items-center">
            <ArrowUpDown size={20} className="me-2" />
            Crane Simulator
          </h5>
          <Button variant="outline-secondary" size="sm" onClick={fetchDevices}>
            <RefreshCw size={16} className="me-1" />
            Refresh
          </Button>
        </Card.Header>
        <Card.Body>
          {craneDevices.length === 0 ? (
            <p className="text-muted mb-0">No crane simulators. Click &quot;Add Crane&quot; to add one.</p>
          ) : (
            <Table responsive striped hover size="sm">
              <thead>
                <tr>
                  <th>Device ID</th>
                  <th>Company</th>
                  <th>Location (lat, long)</th>
                  <th>State</th>
                  <th>Frequency</th>
                  <th>Profile</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {craneDevices.map((device) => (
                  <tr key={device.DeviceID}>
                    <td><strong>{device.DeviceID}</strong></td>
                    <td>{device.craneCompany}</td>
                    <td>
                      <small><MapPin size={12} className="me-1" />
                        {(device.latitude != null ? device.latitude : 0).toFixed(6)}, {(device.longitude != null ? device.longitude : 0).toFixed(6)}
                      </small>
                    </td>
                    <td>{getStateBadge(device.state)}</td>
                    <td><Clock size={14} className="me-1" />{device.frequencyMinutes}m</td>
                    <td><Badge bg="outline-secondary">{device.profile || 'A'}</Badge></td>
                    <td>{getStatusBadge(device)}</td>
                    <td><ActionButtons device={device} /></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* ---------- Section 2: Elevator Simulator ---------- */}
      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0 d-flex align-items-center">
            <Building2 size={20} className="me-2" />
            Elevator Simulator
          </h5>
          <Button variant="outline-secondary" size="sm" onClick={fetchDevices}>
            <RefreshCw size={16} className="me-1" />
            Refresh
          </Button>
        </Card.Header>
        <Card.Body>
          {elevatorDevices.length === 0 ? (
            <p className="text-muted mb-0">No elevator simulators. Click &quot;Add Elevator&quot; to add one. Floor cycles 0→24 each tick; state is manual only.</p>
          ) : (
            <Table responsive striped hover size="sm">
              <thead>
                <tr>
                  <th>Device ID</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>State</th>
                  <th>Frequency</th>
                  <th>Override</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {elevatorDevices.map((device) => (
                  <tr key={device.DeviceID}>
                    <td><strong>{device.DeviceID}</strong></td>
                    <td>{device.craneCompany}</td>
                    <td><small>{device.location || '–'}</small></td>
                    <td>{getStateBadge(device.state)}</td>
                    <td><Clock size={14} className="me-1" />{device.frequencyMinutes}m</td>
                    <td>
                      {(device.overrideReg65 != null || device.overrideReg66 != null || (device.overrideErrorCode && device.overrideErrorCode !== '000')) ? (
                        <Badge bg="info">Reg65/66/Err set</Badge>
                      ) : (
                        <span className="text-muted">–</span>
                      )}
                    </td>
                    <td>{getStatusBadge(device)}</td>
                    <td><ElevatorActionButtons device={device} /></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* ---------- Add Crane Modal ---------- */}
      <Modal show={showAddCraneModal} onHide={() => setShowAddCraneModal(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>Add Simulated Crane</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Company Name *</Form.Label>
                  <Form.Control name="craneCompany" value={craneFormData.craneCompany} onChange={handleCraneInput} placeholder="Gsn Soln" />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Device ID *</Form.Label>
                  <Form.Control name="DeviceID" value={craneFormData.DeviceID} onChange={handleCraneInput} placeholder="CRANE005" required />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Latitude *</Form.Label>
                  <Form.Control type="number" name="latitude" value={craneFormData.latitude} onChange={handleCraneInput} step="0.000001" />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Longitude *</Form.Label>
                  <Form.Control type="number" name="longitude" value={craneFormData.longitude} onChange={handleCraneInput} step="0.000001" />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>State *</Form.Label>
                  <Form.Select name="state" value={craneFormData.state} onChange={handleCraneInput}>
                    <option value="working">Working</option>
                    <option value="idle">Idle</option>
                    <option value="maintenance">Maintenance</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Frequency (min) *</Form.Label>
                  <Form.Select name="frequencyMinutes" value={craneFormData.frequencyMinutes} onChange={handleCraneInput}>
                    {[1, 2, 5, 10, 15, 30].map((n) => (
                      <option key={n} value={n}>{n} minute{n > 1 ? 's' : ''}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Profile</Form.Label>
                  <Form.Select name="profile" value={craneFormData.profile} onChange={handleCraneInput}>
                    <option value="A">Profile A</option>
                    <option value="B">Profile B</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Label className="d-block">Options</Form.Label>
                <Form.Check type="checkbox" name="padTimestamp" checked={craneFormData.padTimestamp} onChange={handleCraneInput} label="Pad Timestamp" />
                <Form.Check type="checkbox" name="jitter" checked={craneFormData.jitter} onChange={handleCraneInput} label="GPS Jitter" />
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddCraneModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleAddCrane} disabled={addingDevice || !craneFormData.DeviceID}>
            {addingDevice ? <><Spinner animation="border" size="sm" className="me-2" />Adding...</> : 'Add Crane'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ---------- Add Elevator Modal ---------- */}
      <Modal show={showAddElevatorModal} onHide={() => setShowAddElevatorModal(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>Add Simulated Elevator</Modal.Title></Modal.Header>
        <Modal.Body>
          <p className="text-muted small">Floor cycles 0→24 each tick. State is manual (change via Edit).</p>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Company Name *</Form.Label>
                  <Form.Control name="elevatorCompany" value={elevatorFormData.elevatorCompany} onChange={handleElevatorInput} placeholder="Gsn Soln" />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Elevator ID *</Form.Label>
                  <Form.Control name="DeviceID" value={elevatorFormData.DeviceID} onChange={handleElevatorInput} placeholder="ELEV001" required />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Label>Location *</Form.Label>
                  <Form.Control name="location" value={elevatorFormData.location} onChange={handleElevatorInput} placeholder="Building A – Lobby" required />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>State *</Form.Label>
                  <Form.Select name="state" value={elevatorFormData.state} onChange={handleElevatorInput}>
                    <option value="working">Working</option>
                    <option value="idle">Idle</option>
                    <option value="maintenance">Maintenance</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Frequency (min) *</Form.Label>
                  <Form.Select name="frequencyMinutes" value={elevatorFormData.frequencyMinutes} onChange={handleElevatorInput}>
                    {[1, 2, 5, 10, 15, 30].map((n) => (
                      <option key={n} value={n}>{n} minute{n > 1 ? 's' : ''}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddElevatorModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleAddElevator} disabled={addingDevice || !elevatorFormData.DeviceID || !elevatorFormData.location?.trim()}>
            {addingDevice ? <><Spinner animation="border" size="sm" className="me-2" />Adding...</> : 'Add Elevator'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ---------- Edit Modal (crane or elevator) ---------- */}
      <Modal show={showEditModal} onHide={() => { setShowEditModal(false); setEditingDevice(null); }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit: {editingDevice?.DeviceID}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingDevice?.deviceType === 'elevator' ? (
            <Form>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Company</Form.Label>
                    <Form.Control name="elevatorCompany" value={editFormData.elevatorCompany} onChange={handleEditInput} />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Device ID</Form.Label>
                    <Form.Control name="DeviceID" value={editFormData.DeviceID} disabled className="bg-light" />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-3">
                <Form.Label>Location</Form.Label>
                <Form.Control name="location" value={editFormData.location} onChange={handleEditInput} />
              </Form.Group>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>State</Form.Label>
                    <Form.Select name="state" value={editFormData.state} onChange={handleEditInput}>
                      <option value="working">Working</option>
                      <option value="idle">Idle</option>
                      <option value="maintenance">Maintenance</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Frequency (min)</Form.Label>
                    <Form.Select name="frequencyMinutes" value={editFormData.frequencyMinutes} onChange={handleEditInput}>
                      {[1, 2, 5, 10, 15, 30].map((n) => (
                        <option key={n} value={n}>{n}m</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
            </Form>
          ) : (
            <Form>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Company</Form.Label>
                    <Form.Control name="craneCompany" value={editFormData.craneCompany} onChange={handleEditInput} />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Device ID</Form.Label>
                    <Form.Control name="DeviceID" value={editFormData.DeviceID} disabled className="bg-light" />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Latitude</Form.Label>
                    <Form.Control type="number" name="latitude" value={editFormData.latitude} onChange={handleEditInput} step="0.000001" />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Longitude</Form.Label>
                    <Form.Control type="number" name="longitude" value={editFormData.longitude} onChange={handleEditInput} step="0.000001" />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>State</Form.Label>
                    <Form.Select name="state" value={editFormData.state} onChange={handleEditInput}>
                      <option value="working">Working</option>
                      <option value="idle">Idle</option>
                      <option value="maintenance">Maintenance</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Frequency (min)</Form.Label>
                    <Form.Select name="frequencyMinutes" value={editFormData.frequencyMinutes} onChange={handleEditInput}>
                      {[1, 2, 5, 10, 15, 30].map((n) => (
                        <option key={n} value={n}>{n}m</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Profile</Form.Label>
                    <Form.Select name="profile" value={editFormData.profile} onChange={handleEditInput}>
                      <option value="A">A</option>
                      <option value="B">B</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Check type="checkbox" name="padTimestamp" checked={editFormData.padTimestamp} onChange={handleEditInput} label="Pad Timestamp" />
                  <Form.Check type="checkbox" name="jitter" checked={editFormData.jitter} onChange={handleEditInput} label="GPS Jitter" />
                </Col>
              </Row>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowEditModal(false); setEditingDevice(null); }}>Cancel</Button>
          <Button variant="primary" onClick={handleUpdateDevice} disabled={updatingDevice}>
            {updatingDevice ? <><Spinner animation="border" size="sm" className="me-2" />Updating...</> : 'Update'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ---------- Elevator Live Override Modal (Reg65, Reg66, Error code) ---------- */}
      <Modal show={showOverrideModal} onHide={() => { setShowOverrideModal(false); setOverrideDevice(null); }} size="md">
        <Modal.Header closeButton>
          <Modal.Title>Live override – {overrideDevice?.DeviceID}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-3">
            Set values sent on every tick. Leave blank to use computed (floor + state). Use 0 or 000 for error code to clear. Next tick uses these immediately.
          </p>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Reg65 (0–65535)</Form.Label>
              <Form.Control
                type="number"
                name="overrideReg65"
                min={0}
                max={65535}
                value={overrideForm.overrideReg65}
                onChange={handleOverrideInput}
                placeholder="e.g. 256 = floor 1"
              />
              <Form.Text className="text-muted">High byte = floor (0–24), low byte = primary status. Empty = use computed floor.</Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Status preset (Reg66)</Form.Label>
              <Form.Select
                name="reg66Preset"
                value={overrideForm.reg66Preset}
                onChange={handleOverrideInput}
              >
                <option value="auto">Auto (use state)</option>
                <option value="normal">Normal – In Service + Comm OK + Normal Power</option>
                <option value="maintenance">Maintenance – Maintenance ON</option>
                <option value="outOfService">Out of Service – All off</option>
                <option value="custom">Custom (enter Reg66)</option>
              </Form.Select>
              <Form.Text className="text-muted d-block mb-1">
                Auto uses elevator state (working/idle/maintenance). Other presets set Reg66 for you.
              </Form.Text>
              {overrideForm.reg66Preset === 'custom' && (
                <>
                  <Form.Control
                    className="mt-2"
                    type="number"
                    name="overrideReg66"
                    min={0}
                    max={65535}
                    value={overrideForm.overrideReg66}
                    onChange={handleOverrideInput}
                    placeholder="e.g. 51216 = In Service, Normal Power"
                  />
                  <Form.Text className="text-muted">High = service bits, low = power bits.</Form.Text>
                </>
              )}
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Error code</Form.Label>
              <Form.Control
                type="text"
                name="overrideErrorCode"
                value={overrideForm.overrideErrorCode}
                onChange={handleOverrideInput}
                placeholder="e.g. 101, 10F, 000 = no error"
              />
              <Form.Text className="text-muted">From lookup table (e.g. 101, 10F). Empty or 000 = no error.</Form.Text>
            </Form.Group>
            <Form.Check
              type="checkbox"
              name="useComputed"
              id="useComputed"
              label="Use computed values (clear all overrides)"
              checked={overrideForm.useComputed}
              onChange={handleOverrideInput}
            />
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowOverrideModal(false); setOverrideDevice(null); }}>Cancel</Button>
          <Button variant="primary" onClick={handleSaveOverride} disabled={savingOverride}>
            {savingOverride ? <><Spinner animation="border" size="sm" className="me-2" />Saving...</> : 'Apply override'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ---------- Info ---------- */}
      <Card>
        <Card.Header>
          <h6 className="mb-0"><Settings size={20} className="me-2" />Notes</h6>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <h6>Device allow-list</h6>
              <p className="text-muted small mb-0">
                To see simulated cranes in the crane dashboard, add the DeviceID to the <strong>Device</strong> collection (companyName, deviceId, deviceType: &quot;crane&quot;). Same for elevators: add deviceId with deviceType: &quot;elevator&quot; so they appear on the Elevator page.
              </p>
            </Col>
            <Col md={6}>
              <h6>Simulator</h6>
              <ul className="text-muted small mb-0">
                <li>Enabled when <code>ENABLE_SIMULATOR=true</code></li>
                <li>Crane: posts to /api/crane/log at configured frequency</li>
                <li>Elevator: posts to /api/elevators/log; floor cycles 0→24 each tick; state is manual only</li>
              </ul>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Container>
  );
}
