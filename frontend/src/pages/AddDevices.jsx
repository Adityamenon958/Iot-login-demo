import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Col, Row, Form, Button, Table, Spinner, Modal } from 'react-bootstrap';
import { Edit, Trash2 } from 'lucide-react';
import styles from './MainContent.module.css';
import './MainContent.css';

export default function AddDevice() {
  const navigate = useNavigate();

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [role, setRole] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [authCompanyName, setAuthCompanyName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [uid, setUid] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [searchColumn, setSearchColumn] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortByDateAsc, setSortByDateAsc] = useState(false);

  useEffect(() => {
    const fetchAuth = async () => {
      try {
        const res = await axios.get('/api/auth/userinfo', { withCredentials: true });
        const { role, companyName, subscriptionStatus } = res.data;

        setRole(role);
        setCompanyName(companyName);
        setAuthCompanyName(companyName);

        const isAuthorized = (role === "admin" || (role === "superadmin"));
        const hasSubscription = subscriptionStatus === "active";

        if (!isAuthorized || !hasSubscription) {
          console.warn("Unauthorized or inactive subscription ❌");
          navigate('/dashboard');
        } else {
          // ✅ Superadmin gets all devices, others get company-filtered
          if (role === 'superadmin') {
            fetchDevices(null); // Pass null to indicate superadmin (all devices)
          } else {
            fetchDevices(companyName); // Company-filtered for non-superadmin
          }
        }
      } catch (err) {
        console.error("Auth fetch failed:", err.message);
        navigate('/dashboard');
      }
    };

    fetchAuth();
  }, [navigate]);


  const fetchDevices = async (company) => {
    setLoading(true);
    try {
      // ✅ Superadmin gets all devices (company = null), others get company-filtered
      const params = company ? { companyName: company } : {};
      const response = await axios.get('/api/devices', { params, withCredentials: true });
      
      setDevices(response.data);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // ✅ Auto-generate UID only in add mode
    if (!isEditMode && companyName && deviceId) {
      const prefix = companyName.split(" ").map(word => word[0]).join('').toUpperCase();
      setUid(`${prefix}-${deviceId}`);
    }
  }, [companyName, deviceId, isEditMode]);

  // ✅ Fetch devices when component loads and when role/companyName changes
  useEffect(() => {
    if (role) {
      if (role === 'superadmin') {
        fetchDevices(null); // Superadmin gets all devices
      } else if (companyName) {
        fetchDevices(companyName); // Others get company-filtered
      }
    }
  }, [role, companyName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEditMode) {
      const isDuplicate = devices.some(device => device.uid === uid);
      if (isDuplicate) {
        alert('Device with same UID already exists!');
        return;
      }

      const formData = { companyName, uid, deviceId, deviceType };

      try {
        const response = await axios.post('/api/devices', formData, { withCredentials: true });
        // ✅ Refresh devices list with company filtering
        fetchDevices(role === 'superadmin' ? null : authCompanyName);
        alert(response.data.message);
        setDeviceId('');
        setDeviceType('');
        setShowModal(false);
      } catch (error) {
        console.error('Error submitting form:', error);
        alert('Failed to add device');
      }
    } else {
      // ✅ Edit device flow
      if (!editingDevice?._id) {
        alert('No device selected for edit');
        return;
      }
      try {
        // Backend supports superadmin changing companyName; admin cannot
        const payload = { deviceId, deviceType };
        if (role === 'superadmin' && companyName) payload.companyName = companyName;
        await axios.put(`/api/devices/${editingDevice._id}`, payload, { withCredentials: true });
        alert('Device updated successfully!');
        setShowModal(false);
        setIsEditMode(false);
        setEditingDevice(null);
        // Restore auth company name in form for new-add flow
        setCompanyName(authCompanyName);
        setUid('');
        setDeviceId('');
        setDeviceType('');
        fetchDevices(role === 'superadmin' ? null : authCompanyName);
      } catch (error) {
        console.error('Error updating device:', error);
        alert('Failed to update device');
      }
    }
  };

  const handleEdit = (dev) => {
    // ✅ Role-based guard: only admin/superadmin
    if (role !== 'admin' && role !== 'superadmin') {
      alert('You do not have permission to edit devices.');
      return;
    }
    // ✅ Admin can only edit within their company
    if (role === 'admin' && dev.companyName !== authCompanyName) {
      alert('Admins can edit only devices in their own company.');
      return;
    }
    setIsEditMode(true);
    setEditingDevice(dev);
    // Prefill form
    setCompanyName(dev.companyName);
    setUid(dev.uid);
    setDeviceId(dev.deviceId || '');
    setDeviceType(dev.deviceType || '');
    setShowModal(true);
  };

  const handleDelete = async (dev) => {
    // ✅ Role-based guard: only admin/superadmin
    if (role !== 'admin' && role !== 'superadmin') {
      alert('You do not have permission to delete devices.');
      return;
    }
    // ✅ Admin can only delete within their company
    if (role === 'admin' && dev.companyName !== authCompanyName) {
      alert('Admins can delete only devices in their own company.');
      return;
    }
    const confirm = window.confirm(`Are you sure you want to delete device ${dev.deviceId}?`);
    if (!confirm) return;
    try {
      await axios.delete(`/api/devices/${dev._id}`, { withCredentials: true });
      alert('Device deleted successfully!');
      fetchDevices(role === 'superadmin' ? null : authCompanyName);
    } catch (err) {
      console.error('Delete device failed:', err);
      alert('Failed to delete device');
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setIsEditMode(false);
    setEditingDevice(null);
    // Restore auth company name for add flow
    setCompanyName(authCompanyName);
    setUid('');
    setDeviceId('');
    setDeviceType('');
  };

  const filteredDevices = devices
    .filter((dev) => {
      if (!searchTerm) return true;
      const lowerTerm = searchTerm.toLowerCase();
      if (searchColumn) {
        return dev[searchColumn]?.toString().toLowerCase().includes(lowerTerm);
      }
      return Object.values(dev).some(val => val?.toString().toLowerCase().includes(lowerTerm));
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return sortByDateAsc ? dateA - dateB : dateB - dateA;
    });

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={`${styles.main} p-4`}>
      <Row className="justify-content-between d-flex align-items-start flex-column justify-content-evenly">
        <Col><h3>Device Management</h3></Col>
        <Col className='mt-3' xs="auto">
          <Button variant="success" onClick={() => setShowModal(true)} className='std_button'>
            Manage Device
          </Button>
        </Col>
      </Row>

      <Modal show={showModal} onHide={handleModalClose} centered className="custom_modal1">
        <Modal.Header className="border-0 px-4 pt-4 pb-0 d-flex justify-content-between align-items-center" closeButton>
          <Modal.Title>{isEditMode ? 'Edit Device' : 'Manage Device'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="my-1">
              <Form.Label className="custom_label1">Company Name</Form.Label>
              {/* ✅ Superadmin can edit company name; Admin sees their company but cannot edit */}
              <Form.Control
                className="custom_input1"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={role !== 'superadmin'}
              />
            </Form.Group>
            <Form.Group className="my-1">
              <Form.Label className="custom_label1">UID</Form.Label>
              <Form.Control className="custom_input1" type="text" value={uid} disabled />
            </Form.Group>
            <Form.Group className="my-1">
              <Form.Label className="custom_label1">Device ID</Form.Label>
              <Form.Control type="text" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} required className="custom_input1" />
            </Form.Group>
            <Form.Group className="my-1">
              <Form.Label className="custom_label1">Device Type</Form.Label>
              {/* ✅ Free text input instead of dropdown */}
              <Form.Control type="text" value={deviceType} onChange={(e) => setDeviceType(e.target.value)} required className="custom_input1" />
            </Form.Group>
            <Button variant="primary" type="submit" className="w-100 signIn1 mb-2">{isEditMode ? 'Save Changes' : 'Submit'}</Button>
          </Form>
        </Modal.Body>
      </Modal>

      <Row className="mt-4">
        <h4 className="mt-3">Existing Devices</h4>
        <Row className="mb-3">
          <Col md={4}>
            <Form.Select value={searchColumn} onChange={(e) => setSearchColumn(e.target.value)} className="custom_input1">
              <option value="">All Columns</option>
              <option value="uid">UID</option>
              <option value="deviceId">Device ID</option>
              <option value="deviceType">Type</option>
              <option value="companyName">Company</option>
              <option value="createdAt">Date</option>
            </Form.Select>
          </Col>
          <Col md={8}>
            <Form.Control type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="custom_input1" />
          </Col>
        </Row>

        <div style={{ position: 'relative', minHeight: '250px' }}>
          {loading && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10, backgroundColor: 'rgba(255,255,255,0.85)', padding: '2rem', borderRadius: '0.5rem' }}>
              <Spinner animation="border" variant="primary" />
            </div>
          )}

          {!loading && (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => setSortByDateAsc(!sortByDateAsc)}>
                    Date {sortByDateAsc ? '↑' : '↓'}
                  </th>
                  <th>UID</th>
                  <th>Device ID</th>
                  <th>Type</th>
                  <th>Company</th>
                  {(role === 'admin' || role === 'superadmin') && (
                    <th>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={role === 'admin' || role === 'superadmin' ? 6 : 5} className="text-center">No matching devices</td>
                  </tr>
                ) : (
                  filteredDevices.map((dev, index) => (
                    <tr key={index}>
                      <td>{new Date(dev.createdAt).toLocaleDateString()}</td>
                      <td>{dev.uid}</td>
                      <td>{dev.deviceId}</td>
                      <td>{dev.deviceType}</td>
                      <td>{dev.companyName}</td>
                      {(role === 'admin' || role === 'superadmin') && (
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div className="d-flex align-items-center gap-2">
                            <Button
                              size="sm"
                              variant="link"
                              onClick={() => handleEdit(dev)}
                              title="Edit Device"
                              disabled={role === 'admin' && dev.companyName !== authCompanyName}
                              style={{ color: '#0d6efd', border: 'none', padding: '4px 8px', textDecoration: 'none' }}
                              className="edit-btn"
                              aria-label="Edit Device"
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              size="sm"
                              variant="link"
                              onClick={() => handleDelete(dev)}
                              title="Delete Device"
                              disabled={role === 'admin' && dev.companyName !== authCompanyName}
                              style={{ color: '#dc3545', border: 'none', padding: '4px 8px', textDecoration: 'none' }}
                              className="delete-btn"
                              aria-label="Delete Device"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </td>
                      )}
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
