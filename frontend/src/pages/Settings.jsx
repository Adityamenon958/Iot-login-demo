
import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Modal, Form, Button, Spinner, Alert } from 'react-bootstrap';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styles from './MainContent.module.css';
import { Edit3, User, Building2, Mail, Phone, Shield, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { generateCompanyInitials, getUserDisplayName, getUserRoleDisplay } from '../lib/userUtils';

export default function Settings() {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editField, setEditField] = useState('');
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ✅ Fetch user info function
  const fetchUserInfo = async () => {
    try {
      console.log('🔄 Fetching user info...');
      const res = await axios.get('/api/auth/userinfo', { withCredentials: true });
              console.log('✅ User info fetched:', res.data);
        console.log('✅ User info structure:', JSON.stringify(res.data, null, 2));
        setUserInfo(res.data);
      setError(''); // Clear any previous errors
    } catch (err) {
      console.error('❌ Failed to fetch user info:', err);
      console.error('❌ Error response:', err.response?.data);
      setError('Failed to load user information. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch user info on component mount
  useEffect(() => {
    fetchUserInfo();
  }, []);

  // ✅ Handle edit field
  const handleEdit = (field, currentValue) => {
    setEditField(field);
    setEditValue(currentValue || '');
    setShowEditModal(true);
    setError('');
    setSuccess('');
  };

  // ✅ Handle save changes
  const handleSave = async () => {
    if (!editValue.trim()) {
      setError('Field cannot be empty');
      return;
    }

    // ✅ Additional validation for specific fields
    if (editField === 'email' && editValue.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editValue.trim())) {
        setError('Please enter a valid email address');
        return;
      }
    }

    if (editField === 'name' && editValue.trim().length < 2) {
      setError('Name must be at least 2 characters long');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      console.log('🔄 Updating profile field:', editField, 'with value:', editValue.trim());
      
      const res = await axios.put('/api/users/profile', {
        [editField]: editValue.trim()
      }, { withCredentials: true });

      console.log('✅ Profile update response:', res.data);

      if (res.data.success) {
        setUserInfo(prev => ({ ...prev, [editField]: editValue.trim() }));
        setSuccess(`${editField.charAt(0).toUpperCase() + editField.slice(1)} updated successfully!`);
        setTimeout(() => setShowEditModal(false), 1500);
      } else {
        setError(res.data.message || 'Update failed');
      }
    } catch (err) {
      console.error('❌ Profile update failed:', err);
      console.error('❌ Error response:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ✅ Handle modal close
  const handleModalClose = () => {
    setShowEditModal(false);
    setEditField('');
    setEditValue('');
    setError('');
    setSuccess('');
  };

  if (loading) {
    return (
      <Col xs={12} md={9} lg={10} xl={10} className={styles.main}>
        <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
          <Spinner animation="border" variant="primary" />
        </div>
      </Col>
    );
  }

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main}>
      <div className="p-3 p-md-4">
        {/* ✅ Success/Error Messages */}
        {success && (
          <Alert variant="success" className="mb-3" dismissible onClose={() => setSuccess('')}>
            ✅ {success}
          </Alert>
        )}
        
        {error && (
          <Alert variant="danger" className="mb-3" dismissible onClose={() => setError('')}>
            ❌ {error}
          </Alert>
        )}

        {/* ✅ Page Header */}
        <div className="mb-4 d-flex justify-content-between align-items-start">
          <div>
            <h2 className="fw-bold text-dark mb-2 fs-3 fs-md-2">Profile Settings</h2>
            <p className="text-muted mb-0">Manage your account information and preferences</p>
          </div>
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => {
              setLoading(true);
              setError('');
              fetchUserInfo();
            }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Loading...
              </>
            ) : (
              '🔄 Refresh'
            )}
          </Button>
        </div>

        <Row className="g-4">
          {/* ✅ Profile Card */}
          <Col xs={12} lg={4}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Body className="text-center p-4 d-flex flex-column">
                {/* ✅ Large Text Avatar */}
                <div className="mb-4">
                  <div 
                    className="mx-auto"
                    style={{
                      width: 'clamp(80px, 20vw, 120px)',
                      height: 'clamp(80px, 20vw, 120px)',
                      background: 'linear-gradient(135deg, #4db3b3, #3a8a8a)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 'clamp(24px, 5vw, 36px)',
                      fontWeight: '700',
                      letterSpacing: '1px',
                      textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    {generateCompanyInitials(userInfo?.companyName)}
                  </div>
                </div>

                {/* ✅ User Info */}
                <h4 className="fw-bold text-dark mb-2">
                  {getUserDisplayName(userInfo)}
                </h4>
                <p className="text-muted mb-3">
                  {getUserRoleDisplay(userInfo?.role)}
                </p>

                {/* ✅ Company Badge */}
                <div className="d-inline-block px-3 py-2 bg-light rounded-pill">
                  <Building2 size={16} className="me-2 text-primary" />
                  <span className="fw-medium">{userInfo?.companyName || 'No Company'}</span>
                </div>
                
                {/* ✅ Spacer to push content to top */}
                <div className="flex-grow-1"></div>
              </Card.Body>
            </Card>
          </Col>

          {/* ✅ User Details */}
          <Col xs={12} lg={8}>
            <Card className="border-0 shadow-sm h-100">
              <Card.Header className="bg-white border-0 pb-0">
                <h5 className="fw-bold text-dark mb-0">Personal Information</h5>
              </Card.Header>
              <Card.Body className="p-4 d-flex flex-column">
                <Row className="g-3">
                  {/* ✅ Name Field */}
                  <Col xs={12} md={6} className="mb-3">
                    <div className="d-flex align-items-center justify-content-between p-3 border rounded-3 bg-light">
                      <div className="d-flex align-items-center flex-grow-1">
                        <User size={20} className="me-2 me-md-3 text-primary flex-shrink-0" />
                        <div className="min-w-0 flex-grow-1">
                          <small className="text-muted d-block">Full Name</small>
                          <span className="fw-medium text-truncate d-block">{userInfo?.name || 'Not set'}</span>
                        </div>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-primary p-0 flex-shrink-0 ms-2"
                        onClick={() => handleEdit('name', userInfo?.name)}
                      >
                        <Edit3 size={16} />
                      </Button>
                    </div>
                  </Col>

                  {/* ✅ Email Field */}
                  <Col xs={12} md={6} className="mb-3">
                    <div className="d-flex align-items-center justify-content-between p-3 border rounded-3 bg-light">
                      <div className="d-flex align-items-center flex-grow-1">
                        <Mail size={20} className="me-2 me-md-3 text-primary flex-shrink-0" />
                        <div className="min-w-0 flex-grow-1">
                          <small className="text-muted d-block">Email Address</small>
                          <span className="fw-medium text-truncate d-block">{userInfo?.email || 'Not set'}</span>
                        </div>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-primary p-0 flex-shrink-0 ms-2"
                        onClick={() => handleEdit('email', userInfo?.email)}
                      >
                        <Edit3 size={16} />
                      </Button>
                    </div>
                  </Col>

                  {/* ✅ Contact Field */}
                  <Col xs={12} md={6} className="mb-3">
                    <div className="d-flex align-items-center justify-content-between p-3 border rounded-3 bg-light">
                      <div className="d-flex align-items-center flex-grow-1">
                        <Phone size={20} className="me-2 me-md-3 text-primary flex-shrink-0" />
                        <div className="min-w-0 flex-grow-1">
                          <small className="text-muted d-block">Contact Info</small>
                          <span className="fw-medium text-truncate d-block">{userInfo?.contactInfo || 'Not set'}</span>
                        </div>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-primary p-0 flex-shrink-0 ms-2"
                        onClick={() => handleEdit('contactInfo', userInfo?.contactInfo)}
                      >
                        <Edit3 size={16} />
                      </Button>
                    </div>
                  </Col>

                  {/* ✅ Role Field */}
                  <Col xs={12} md={6} className="mb-3">
                    <div className="d-flex align-items-center justify-content-between p-3 border rounded-3 bg-light">
                      <div className="d-flex align-items-center flex-grow-1">
                        <Shield size={20} className="me-2 me-md-3 text-primary flex-shrink-0" />
                        <div className="min-w-0 flex-grow-1">
                          <small className="text-muted d-block">User Role</small>
                          <span className="fw-medium text-truncate d-block">{getUserRoleDisplay(userInfo?.role)}</span>
                        </div>
                      </div>
                      <div className="text-muted flex-shrink-0 ms-2">
                        <small>Cannot edit</small>
                      </div>
                    </div>
                  </Col>
                </Row>

                {/* ✅ Subscription Status */}
                <div className="mt-4 pt-4 border-top">
                  <h6 className="fw-bold text-dark mb-3">Subscription Status</h6>
                  <div className="d-flex align-items-center justify-content-between p-3 border rounded-3 bg-light">
                    <div className="d-flex align-items-center">
                      <Calendar size={20} className="me-3 text-primary" />
                      <div>
                        <small className="text-muted d-block">Status</small>
                        <span className="fw-medium">
                          {userInfo?.subscriptionStatus === 'active' ? (
                            <span className="text-success">
                              <CheckCircle size={16} className="me-1" />
                              Active
                            </span>
                          ) : (
                            <span className="text-danger">
                              <XCircle size={16} className="me-1" />
                              Inactive
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="text-muted">
                      <small>Auto-managed</small>
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>

      {/* ✅ Edit Modal */}
      <Modal show={showEditModal} onHide={handleModalClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit {editField.charAt(0).toUpperCase() + editField.slice(1)}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
          {success && <Alert variant="success" className="mb-3">{success}</Alert>}
          
          <Form.Group>
            <Form.Label className="fw-medium">New {editField.charAt(0).toUpperCase() + editField.slice(1)}</Form.Label>
            <Form.Control
              type={editField === 'email' ? 'email' : 'text'}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={`Enter your ${editField}`}
              className="form-control-lg"
              autoFocus
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={handleModalClose}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSave}
            disabled={saving || !editValue.trim()}
          >
            {saving ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Col>
  );
}
