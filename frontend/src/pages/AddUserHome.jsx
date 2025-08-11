import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Col, Row, Form, Button, Spinner, Modal } from 'react-bootstrap';
import styles from "./MainContent.module.css";
import validationStyles from "./AddUserHome.module.css";
import "./MainContent.css";
import { 
  validateEmail, 
  validatePassword, 
  getStrengthColor, 
  getStrengthText, 
  getRequirementIcon, 
  getRequirementColor 
} from '../lib/validation.js';

export default function AddUserHome() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    companyName: '',
    contactInfo: '',
    email: '',
    password: '',
    role: 'user',
    name: '',
  });

  // ✅ Validation state management
  const [validation, setValidation] = useState({
    email: { isValid: false, message: '', status: 'neutral' },
    password: { isValid: false, strength: 'weak', requirements: {}, message: '', status: 'neutral' }
  });

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchColumn, setSearchColumn] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortByDateAsc, setSortByDateAsc] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectAllUsers, setSelectAllUsers] = useState(false);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await axios.get('/api/auth/userinfo', { withCredentials: true });
        const { companyName, role, subscriptionStatus } = res.data;

        if (role !== "admin" || subscriptionStatus !== "active") {
          console.warn("Unauthorized access or inactive subscription ❌");
          navigate('/dashboard');
          return;
        }

        setFormData((prev) => ({
          ...prev,
          companyName: companyName || '',
        }));

        fetchUsers(companyName);
      } catch (err) {
        console.error("Failed to fetch user info:", err);
        navigate('/dashboard');
      }
    };

    fetchUserInfo();
  }, [navigate]);

  const fetchUsers = async (companyName) => {
    setLoading(true);
    try {
      const res = await axios.get('/api/users', {
        params: { companyName },
        withCredentials: true,
      });
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Enhanced form change handler with validation
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // ✅ Real-time validation
    if (name === 'email') {
      const emailValidation = validateEmail(value);
      setValidation(prev => ({
        ...prev,
        email: {
          ...emailValidation,
          status: value ? (emailValidation.isValid ? 'valid' : 'invalid') : 'neutral'
        }
      }));
    }

    if (name === 'password') {
      const passwordValidation = validatePassword(value);
      setValidation(prev => ({
        ...prev,
        password: {
          ...passwordValidation,
          status: value ? (passwordValidation.isValid ? 'valid' : 'invalid') : 'neutral'
        }
      }));
    }
  };

  // ✅ Enhanced form submission with validation
  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ Final validation check before submission
    const emailValidation = validateEmail(formData.email);
    const passwordValidation = validatePassword(formData.password);

    if (!emailValidation.isValid || !passwordValidation.isValid) {
      alert('Please fix validation errors before submitting');
      return;
    }

    try {
      const res = await axios.post('/api/users', formData, { withCredentials: true });
      alert(res.data.message);
      
      // ✅ Reset form with validation state
      setFormData({
        companyName: formData.companyName,
        contactInfo: '',
        email: '',
        password: '',
        role: 'user',
        name: '',
      });
      
      // ✅ Reset validation state
      setValidation({
        email: { isValid: false, message: '', status: 'neutral' },
        password: { isValid: false, strength: 'weak', requirements: {}, message: '', status: 'neutral' }
      });
      
      fetchUsers(formData.companyName);
      setShowModal(false);
    } catch (err) {
      console.error(err.response?.data || err.message);
      alert(err.response?.data?.message || "Something went wrong ❌");
    }
  };

  // ✅ Get strength bar width percentage
  const getStrengthWidth = (strength) => {
    switch (strength) {
      case 'excellent': return '100%';
      case 'strong': return '80%';
      case 'medium': return '60%';
      case 'weak': return '30%';
      default: return '0%';
    }
  };

  const filteredUsers = users
    .filter(user => {
      if (!searchTerm) return true;
      const lowerTerm = searchTerm.toLowerCase();

      if (searchColumn) {
        return user[searchColumn]?.toString().toLowerCase().includes(lowerTerm);
      }

      return Object.values(user).some(val =>
        val?.toString().toLowerCase().includes(lowerTerm)
      );
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return sortByDateAsc ? dateA - dateB : dateB - dateA;
    });

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={`${styles.main} p-4`}>
      <Row className="justify-content-between d-flex align-items-start flex-column justify-content-evenly">
        <Col><h2 className="mb-4">User Management</h2></Col>
        <Col xs="auto">
          <Button variant="success" onClick={() => setShowModal(true)} className='std_button'>
            Add User
          </Button>
        </Col>
      </Row>

      {/* ✅ Enhanced Modal for Add User Form */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered className="custom_modal1">
        <Modal.Header closeButton className="border-0 px-4 pt-4 pb-0 d-flex justify-content-between align-items-center">
          <Modal.Title>Add New User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label className='custom_label1'>Full Name</Form.Label>
              <Form.Control 
                type="text" 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                placeholder="Enter Full name" 
                className="custom_input1" 
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label className='custom_label1'>Contact Info</Form.Label>
              <Form.Control 
                type="text" 
                name="contactInfo" 
                value={formData.contactInfo} 
                onChange={handleChange} 
                placeholder="Enter contact info" 
                className="custom_input1" 
              />
            </Form.Group>
            
            {/* ✅ Enhanced Email Field with Validation */}
            <Form.Group className="mb-3">
              <Form.Label className='custom_label1'>Email ID</Form.Label>
              <div className={validationStyles.inputGroup}>
                <Form.Control 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleChange} 
                  placeholder="Enter email" 
                  className={`custom_input1 ${validationStyles.formControl} ${validationStyles[validation.email.status]}`}
                  required
                />
                {formData.email && (
                  <span className={validationStyles.validationIcon}>
                    {validation.email.isValid ? '✅' : '❌'}
                  </span>
                )}
              </div>
              {/* ✅ Email validation feedback */}
              {formData.email && (
                <div className={`${validationStyles.emailValidation} ${validationStyles[validation.email.status]}`}>
                  <span>{validation.email.isValid ? '✅' : '❌'}</span>
                  <span>{validation.email.message}</span>
                </div>
              )}
            </Form.Group>
            
            {/* ✅ Enhanced Password Field with Strength Meter */}
            <Form.Group className="mb-3">
              <Form.Label className='custom_label1'>Password</Form.Label>
              <div className={validationStyles.inputGroup}>
                <Form.Control 
                  type="password" 
                  name="password" 
                  value={formData.password} 
                  onChange={handleChange} 
                  placeholder="Enter password" 
                  className={`custom_input1 ${validationStyles.formControl} ${validationStyles[validation.password.status]}`}
                  required
                />
                {formData.password && (
                  <span className={validationStyles.validationIcon}>
                    {validation.password.isValid ? '✅' : '❌'}
                  </span>
                )}
              </div>
              
              {/* ✅ Password strength meter */}
              {formData.password && (
                <div className={validationStyles.passwordStrengthMeter}>
                  <div className={validationStyles.strengthBar}>
                    <div 
                      className={`${validationStyles.strengthFill} ${validationStyles.animated}`}
                      style={{
                        width: getStrengthWidth(validation.password.strength),
                        backgroundColor: getStrengthColor(validation.password.strength)
                      }}
                    />
                  </div>
                  <div className={validationStyles.strengthText}>
                    Password Strength: <strong style={{ color: getStrengthColor(validation.password.strength) }}>
                      {getStrengthText(validation.password.strength)}
                    </strong>
                  </div>
                  
                  {/* ✅ Password requirements checklist */}
                  <div className={validationStyles.requirementsList}>
                    <div className={validationStyles.requirementItem}>
                      <span className={validationStyles.requirementIcon} style={{ color: getRequirementColor(validation.password.requirements.length) }}>
                        {getRequirementIcon(validation.password.requirements.length)}
                      </span>
                      <span>At least 8 characters</span>
                    </div>
                    <div className={validationStyles.requirementItem}>
                      <span className={validationStyles.requirementIcon} style={{ color: getRequirementColor(validation.password.requirements.uppercase) }}>
                        {getRequirementIcon(validation.password.requirements.uppercase)}
                      </span>
                      <span>At least 1 uppercase letter</span>
                    </div>
                    <div className={validationStyles.requirementItem}>
                      <span className={validationStyles.requirementIcon} style={{ color: getRequirementColor(validation.password.requirements.lowercase) }}>
                        {getRequirementIcon(validation.password.requirements.lowercase)}
                      </span>
                      <span>At least 1 lowercase letter</span>
                    </div>
                    <div className={validationStyles.requirementItem}>
                      <span className={validationStyles.requirementIcon} style={{ color: getRequirementColor(validation.password.requirements.number) }}>
                        {getRequirementIcon(validation.password.requirements.number)}
                      </span>
                      <span>At least 1 number</span>
                    </div>
                    <div className={validationStyles.requirementItem}>
                      <span className={validationStyles.requirementIcon} style={{ color: getRequirementColor(validation.password.requirements.symbol) }}>
                        {getRequirementIcon(validation.password.requirements.symbol)}
                      </span>
                      <span>At least 1 special character</span>
                    </div>
                    <div className={validationStyles.requirementItem}>
                      <span className={validationStyles.requirementIcon} style={{ color: getRequirementColor(validation.password.requirements.notCommon) }}>
                        {getRequirementIcon(validation.password.requirements.notCommon)}
                      </span>
                      <span>Not a common password</span>
                    </div>
                  </div>
                </div>
              )}
            </Form.Group>
            
            <Button 
              variant="primary" 
              type="submit" 
              className={`w-100 signIn1 mb-2 ${validationStyles.submitButton}`}
              disabled={!validation.email.isValid || !validation.password.isValid}
            >
              Submit
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Users Table */}
      <Row>
        <div className="p-4 ps-3 table2Scroll" style={{ position: 'relative', minHeight: '250px' }}>
          <h3 className="">Users List</h3>
          <Row className="mb-3">
            <Col md={4}>
              <Form.Select value={searchColumn} onChange={(e) => setSearchColumn(e.target.value)} className="custom_input1">
                <option value="">All Columns</option>
                <option value="companyName">Company</option>
                <option value="name">Name</option>
                <option value="contactInfo">Contact</option>
                <option value="email">Email</option>
                <option value="password">Password</option>
                <option value="role">Role</option>
              </Form.Select>
            </Col>
            <Col md={8}>
              <Form.Control type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="custom_input1" />
            </Col>
          </Row>

          {loading && (
            <div style={{ position: 'absolute', top: '80%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10, backgroundColor: 'rgba(255,255,255,0.85)', padding: '2rem', borderRadius: '0.5rem' }}>
              <Spinner animation="border" variant="primary" />
            </div>
          )}

          {!loading && (
            <table className="table table-striped align-middle text-nowrap">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectAllUsers}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setSelectAllUsers(isChecked);
                      if (isChecked) {
                        const allIds = filteredUsers.map(user => user._id);
                        setSelectedUserIds(allIds);
                      } else {
                        setSelectedUserIds([]);
                      }
                    }}
                  />
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => setSortByDateAsc(!sortByDateAsc)}>
                  Date {sortByDateAsc ? '↑' : '↓'}
                </th>
                <th>Company Name</th>
                <th>Name</th>
                <th>Contact</th>
                <th>Email ID</th>
                <th>Password</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan="9" className="text-center">No matching users found</td></tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user._id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user._id)}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          if (isChecked) {
                            setSelectedUserIds(prev => [...prev, user._id]);
                          } else {
                            setSelectedUserIds(prev => prev.filter(id => id !== user._id));
                            setSelectAllUsers(false);
                          }
                        }}
                      />
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>{user.companyName || '-'}</td>
                    <td>{user.name || '-'}</td>
                    <td>{user.contactInfo || '-'}</td>
                    <td>{user.email}</td>
                    <td>{user.password}</td>
                    <td>{user.role}</td>
                    <td>
                      <Form.Check type="switch" id={`toggle-${user._id}`} label="" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          )}
        </div>
      </Row>
    </Col>
  );
}
