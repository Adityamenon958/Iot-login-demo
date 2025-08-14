import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Row, Col, Form, Button, Spinner, Modal, Tabs, Tab } from 'react-bootstrap';
import { Users, Building2, Shield, Edit, Trash2 } from 'lucide-react';
import styles from "./MainContent.module.css";
import "./MainContent.css";
import CompanyDashboardAccessManager from '../components/CompanyDashboardAccessManager';
import { 
  validateEmail, 
  validatePassword, 
  getStrengthColor, 
  getStrengthText, 
  getRequirementIcon, 
  getRequirementColor 
} from '../lib/validation.js';

const AddUser = () => {
  const [formData, setFormData] = useState({
    companyName: '',
    contactInfo: '',
    email: '',
    password: '',
    role: 'admin',
    name: '',
  });

  // ✅ Validation state management
  const [validation, setValidation] = useState({
    email: { isValid: false, message: '', status: 'neutral' },
    password: { isValid: false, strength: 'weak', requirements: {}, message: '', status: 'neutral' }
  });

  // ✅ Edit/Delete state management
  const [editingUser, setEditingUser] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [users, setUsers] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchColumn, setSearchColumn] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortByDateAsc, setSortByDateAsc] = useState(false); // newest first by default
  const [activeTab, setActiveTab] = useState('users');
  
  // ✅ Multi-select state management
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectAllUsers, setSelectAllUsers] = useState(false);

  useEffect(() => {
    const fetchAuthAndUsers = async () => {
      try {
        const res = await axios.get('/api/auth/userinfo', { withCredentials: true });
        const { companyName, role, email } = res.data;
        setCompanyName(companyName);
        setRole(role);
        setCurrentUserEmail(email || '');
  
        if (!companyName || companyName.trim() === "") {
          setUsers([]);
          setLoading(false);
          return;
        }
  
        // Fetch all users if superadmin of Gsn Soln, else filter by company
        const params = companyName === "Gsn Soln" ? {} : { companyName };
        const userRes = await axios.get('/api/users', { params });
        setUsers(userRes.data);
      } catch (err) {
        console.error("Auth/User fetch failed:", err.message);
      } finally {
        setLoading(false);
      }
    };
  
    fetchAuthAndUsers();
  }, []);
  
  // ✅ Standalone fetchUsers function for refresh
  const fetchUsers = async () => {
    try {
      const params = companyName === "Gsn Soln" ? {} : { companyName };
      const userRes = await axios.get('/api/users', { params });
      setUsers(userRes.data);
    } catch (err) {
      console.error("Failed to fetch users:", err.message);
    }
  };

  // ✅ Multi-select handlers
  const handleSelectUser = (userId) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // ✅ Status toggle handler
  const handleToggleStatus = async (userId, newStatus) => {
    try {
      const user = users.find(u => u._id === userId);
      if (!user) return;

      // Role restrictions: Only superadmin can toggle any user, admin can only toggle regular users
      if (role !== 'superadmin' && (user.role === 'admin' || user.role === 'superadmin')) {
        alert('You can only toggle status for regular users. Admins and superadmins cannot be toggled by regular admins.');
        return;
      }

      // Update user status
      const res = await axios.put(`/api/users/${userId}`, {
        isActive: newStatus
      }, { withCredentials: true });

      if (res.data.success) {
        // Update local state
        setUsers(prev => prev.map(u => 
          u._id === userId ? { ...u, isActive: newStatus } : u
        ));
        
        const statusText = newStatus ? 'activated' : 'deactivated';
        alert(`User ${statusText} successfully!`);
      }
    } catch (err) {
      console.error('Toggle status error:', err);
      alert('Failed to toggle user status. Please try again.');
    }
  };

  const handleSelectAll = () => {
    if (selectAllUsers) {
      setSelectedUserIds([]);
      setSelectAllUsers(false);
    } else {
      setSelectedUserIds(filteredUsers.map(user => user._id));
      setSelectAllUsers(true);
    }
  };

  const handleBulkDelete = () => {
    if (selectedUserIds.length === 0) return;
    
    const selectedUsers = filteredUsers.filter(user => selectedUserIds.includes(user._id));
    setUserToDelete({ 
      _id: 'bulk', 
      name: `${selectedUserIds.length} selected users`,
      isBulk: true,
      userIds: selectedUserIds
    });
    setShowDeleteModal(true);
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
    
    // ✅ Password validation only required for new users, optional for edits
    if (!isEditMode) {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        alert('Please fix password validation errors before submitting');
        return;
      }
    }

    if (!emailValidation.isValid) {
      alert('Please fix email validation errors before submitting');
      return;
    }

    try {
      if (isEditMode) {
        // ✅ Update existing user
        const updateData = { ...formData };
        if (!updateData.password) delete updateData.password; // Remove empty password
        
        const res = await axios.put(`/api/users/${editingUser._id}`, updateData, { withCredentials: true });
        alert('User updated successfully!');
      } else {
        // ✅ Create new user
      const res = await axios.post('/api/users', formData);
      alert(res.data.message);
      }
      
      // ✅ Reset form and close modal
      handleModalClose();
      fetchUsers();
      
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

  // ✅ Edit handler
  const handleEdit = (user) => {
    // ✅ Role restrictions: Only superadmin can edit any user, admin can only edit users
    if (role !== 'superadmin' && (user.role === 'admin' || user.role === 'superadmin')) {
      alert('You can only edit regular users. Admins and superadmins cannot be edited by regular admins.');
      return;
    }
    
    setEditingUser(user);
    setIsEditMode(true);
    setFormData({
      companyName: user.companyName || '',
      contactInfo: user.contactInfo || '',
      email: user.email || '',
      password: '', // Don't pre-fill password for security
      role: user.role || 'user',
      name: user.name || '',
    });
    setShowModal(true);
  };

  // ✅ Delete handler
  const handleDelete = (user) => {
    // ✅ Delete restrictions: Users cannot delete themselves
    // Fetch current user email from userinfo endpoint if not already
    // For reliability, compare against currently authenticated user email from backend
    if (currentUserEmail && user.email === currentUserEmail) {
      alert('You cannot delete yourself!');
      return;
    }

    // ✅ Role restrictions: Only superadmin can delete any user, admin can only delete users
    if (role !== 'superadmin' && (user.role === 'admin' || user.role === 'superadmin')) {
      alert('You can only delete regular users. Admins and superadmins cannot be deleted by regular admins.');
      return;
    }

    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  // ✅ Modal close handler
  const handleModalClose = () => {
    setShowModal(false);
    setIsEditMode(false);
    setEditingUser(null);
      setFormData({
        companyName: '',
        contactInfo: '',
        email: '',
        password: '',
        role: 'admin',
        name: '',
      });
    setValidation({
      email: { isValid: false, message: '', status: 'neutral' },
      password: { isValid: false, strength: 'weak', requirements: {}, message: '', status: 'neutral' }
    });
  };

  // ✅ Delete confirmation handler
  const confirmDelete = async () => {
    if (!deletePassword.trim()) {
      alert('Please enter your password to confirm deletion');
      return;
    }

    try {
      setDeleteLoading(true);
      
      if (userToDelete.isBulk) {
        // ✅ Bulk delete with password authentication
        const deletePromises = userToDelete.userIds.map(userId => 
          axios.delete(`/api/users/${userId}`, {
            data: { password: deletePassword },
            withCredentials: true
          })
        );
        
        await Promise.all(deletePromises);
        alert(`${userToDelete.userIds.length} users deleted successfully!`);
        
        // Reset selection state
        setSelectedUserIds([]);
        setSelectAllUsers(false);
      } else {
        // ✅ Single user delete
        const res = await axios.delete(`/api/users/${userToDelete._id}`, {
          data: { password: deletePassword },
          withCredentials: true
        });
        alert('User deleted successfully!');
      }
      setShowDeleteModal(false);
      setUserToDelete(null);
      setDeletePassword('');
      fetchUsers();
      
    } catch (err) {
      console.error(err.response?.data || err.message);
      if (err.response?.status === 401) {
        alert('Incorrect password!!!');
      } else {
        alert(err.response?.data?.message || "Failed to delete user ❌");
      }
    } finally {
      setDeleteLoading(false);
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
        <Col><h2 className="mb-4">Manage  Company</h2></Col>
        <Col xs="auto">
          <Button variant="success" onClick={() => setShowModal(true)} className='std_button'>
            Add Company
          </Button>
        </Col>
      </Row>

      {/* Modal */}
      <Modal show={showModal} onHide={handleModalClose} centered className="custom_modal1">
        <Modal.Header closeButton className="border-0 px-4 pt-4 pb-0 d-flex justify-content-between align-items-center">
          <Modal.Title>{isEditMode ? 'Edit User' : 'Add Company'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label className='custom_label1'>Full Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter full name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="custom_input1"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className='custom_label1'>Company Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter company name"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                className="custom_input1"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className='custom_label1'>Contact Info</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter contact info"
                name="contactInfo"
                value={formData.contactInfo}
                onChange={handleChange}
                className="custom_input1"
              />
            </Form.Group>
            {/* ✅ Enhanced Email Field with Validation */}
            <Form.Group className="mb-3">
              <Form.Label className='custom_label1'>Email ID</Form.Label>
              <div style={{ position: 'relative' }}>
              <Form.Control
                type="email"
                placeholder="Enter email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="custom_input1"
                  required
              />
                {formData.email && (
                  <span style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '16px'
                  }}>
                    {validation.email.isValid ? '✅' : '❌'}
                  </span>
                )}
              </div>
              {/* ✅ Email validation feedback */}
              {formData.email && (
                <div style={{
                  fontSize: '14px',
                  marginTop: '5px',
                  color: validation.email.isValid ? '#28a745' : '#dc3545'
                }}>
                  <span>{validation.email.isValid ? '✅' : '❌'}</span>
                  <span style={{ marginLeft: '5px' }}>{validation.email.message}</span>
                </div>
              )}
            </Form.Group>
            {/* ✅ Enhanced Password Field with Strength Meter */}
            <Form.Group className="mb-3">
              <Form.Label className='custom_label1'>
                Password {isEditMode && <span className="text-muted">(Leave blank to keep current)</span>}
              </Form.Label>
              <div style={{ position: 'relative' }}>
              <Form.Control
                type="password"
                  placeholder={isEditMode ? "Enter new password (optional)" : "Enter password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="custom_input1"
                  required={!isEditMode}
              />
                {formData.password && (
                  <span style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '16px'
                  }}>
                    {validation.password.isValid ? '✅' : '❌'}
                  </span>
                )}
              </div>
              
              {/* ✅ Password strength meter */}
              {formData.password && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{
                    height: '8px',
                    backgroundColor: '#e9ecef',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    marginBottom: '8px'
                  }}>
                    <div 
                      style={{
                        height: '100%',
                        width: getStrengthWidth(validation.password.strength),
                        backgroundColor: getStrengthColor(validation.password.strength),
                        transition: 'width 0.3s ease, background-color 0.3s ease'
                      }}
                    />
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#6c757d'
                  }}>
                    Password Strength: <strong style={{ color: getStrengthColor(validation.password.strength) }}>
                      {getStrengthText(validation.password.strength)}
                    </strong>
                  </div>
                  
                  {/* ✅ Password requirements checklist */}
                  <div style={{
                    marginTop: '10px',
                    fontSize: '12px'
                  }}>
                    {Object.entries(validation.password.requirements || {}).map(([requirement, met]) => (
                      <div key={requirement} style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '4px',
                        color: met ? '#28a745' : '#6c757d'
                      }}>
                        <span style={{ marginRight: '6px' }}>
                          {met ? '✅' : '⭕'}
                        </span>
                        <span style={{ textTransform: 'capitalize' }}>
                          {requirement.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Form.Group>
            <Button variant="primary" type="submit" className="w-100 signIn1 mb-2">
              {isEditMode ? 'Update User' : 'Submit'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* ✅ Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete <strong>{userToDelete?.name}</strong>?</p>
          <p className="text-muted">This action cannot be undone.</p>
          
          <Form.Group className="mt-3">
            <Form.Label>Enter your password to confirm deletion:</Form.Label>
            <Form.Control
              type="password"
              placeholder="Enter your password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              required
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={confirmDelete}
            disabled={deleteLoading || !deletePassword.trim()}
          >
            {deleteLoading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Deleting...
              </>
            ) : (
              'Delete User'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modern Tabs */}
      <div className="modern-tabs-container">
        <Tabs 
          activeKey={activeTab} 
          onSelect={setActiveTab} 
          className="mb-4 modern-tabs"
          style={{
            '--bs-nav-tabs-border-width': '0',
            '--bs-nav-tabs-border-radius': '0.75rem',
            '--bs-nav-tabs-link-hover-border-color': 'transparent',
            '--bs-nav-tabs-link-active-color': '#3b82f6',
            '--bs-nav-tabs-link-active-bg': '#eff6ff',
            '--bs-nav-tabs-link-active-border-color': 'transparent'
          }}
        >
          <Tab 
            eventKey="users" 
            title={
              <div className="d-flex align-items-center gap-2">
                <Users size={18} />
                <span>Manage Users</span>
              </div>
            }
            className="modern-tab-content"
          >
      {/* Table */}
      <Row>
        <div className="p-4 table2Scroll" style={{ position: 'relative', minHeight: '250px' }}>
          <h3 className="mb-3">Users List</h3>

                {/* ✅ Header Actions Bar */}
                <div className="d-flex justify-content-end mb-3">
                  {selectedUserIds.length > 0 && (
                    <Button 
                      variant="outline-danger" 
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={selectedUserIds.length === 0}
                    >
                      <Trash2 size={16} className="me-1" />
                      Delete Selected ({selectedUserIds.length})
                    </Button>
                  )}
                </div>

          {/* Search Filter */}
      <Row className="mb-3">
        <Col md={4} className=''>
          <Form.Select
            value={searchColumn}
            onChange={(e) => setSearchColumn(e.target.value)}
            className="custom_input1"
          >
            <option value="">All Columns</option>
            <option value="companyName">Company</option>
            <option value="name">Name</option>
            <option value="contactInfo">Contact</option>
            <option value="email">Email</option>
            <option value="role">Role</option>
          </Form.Select>
        </Col>
        <Col md={8} className=''>
          <Form.Control
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="custom_input1"
          />
        </Col>
      </Row>

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
            <table className="table table-striped align-middle text-nowrap">
              <thead>
                <tr>
                        <th>
                          <Form.Check
                            type="checkbox"
                            checked={selectAllUsers}
                            onChange={handleSelectAll}
                          />
                        </th>
                  <th>Company Name</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Email ID</th>
                  <th>Role</th>
                  <th
                    onClick={() => setSortByDateAsc(!sortByDateAsc)}
                    style={{ cursor: "pointer" }}
                  >
                    Date {sortByDateAsc ? "↑" : "↓"}
                  </th>
                  <th>Toggle</th>
                        <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                          <td colSpan="9" className="text-center">No matching users found</td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr key={user._id}>
                            <td>
                              <Form.Check
                                type="checkbox"
                                checked={selectedUserIds.includes(user._id)}
                                onChange={() => handleSelectUser(user._id)}
                              />
                            </td>
                      <td>{user.companyName || '-'}</td>
                      <td>{user.name || '-'}</td>
                      <td>{user.contactInfo || '-'}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td>
                        <Form.Check
                          type="switch"
                          id={`toggle-${user._id}`}
                          label=""
                                checked={user.isActive !== false} // Default to true if not set
                                onChange={() => handleToggleStatus(user._id, !user.isActive)}
                                disabled={role !== 'superadmin' && (user.role === 'admin' || user.role === 'superadmin')}
                        />
                      </td>
                            <td>
                              <div className="d-flex gap-2 align-items-center">
                                <Button 
                                  size="sm" 
                                  variant="link" 
                                  onClick={() => handleEdit(user)}
                                  title="Edit User"
                                  disabled={
                                    role !== 'superadmin' && (user.role === 'admin' || user.role === 'superadmin') ||
                                    selectedUserIds.length > 0 // Disable when multiple selected
                                  }
                                  style={{ 
                                    color: '#3b82f6', 
                                    border: 'none',
                                    padding: '4px 8px',
                                    textDecoration: 'none'
                                  }}
                                  className="edit-btn"
                                  aria-label="Edit User"
                                >
                                  <Edit size={16} />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="link" 
                                  onClick={() => handleDelete(user)}
                                  title="Delete User"
                                  disabled={
                                    role !== 'superadmin' && (user.role === 'admin' || user.role === 'superadmin') ||
                                    selectedUserIds.length > 0 // Disable when multiple selected
                                  }
                                  style={{ 
                                    color: '#dc3545', 
                                    border: 'none',
                                    padding: '4px 8px',
                                    textDecoration: 'none'
                                  }}
                                  className="delete-btn"
                                  aria-label="Delete User"
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </Row>
          </Tab>
          
          <Tab 
            eventKey="dashboard-access" 
            title={
              <div className="d-flex align-items-center gap-2">
                <Building2 size={18} />
                <span>Dashboard Access</span>
              </div>
            }
            className="modern-tab-content"
          >
            <CompanyDashboardAccessManager />
          </Tab>
        </Tabs>
      </div>

      <style jsx>{`
        .modern-tabs-container {
          background: #ffffff;
          border-radius: 1.625rem;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
          padding: 2rem;
          margin: 1rem 0;
        }

        /* ✅ Hover effects for action buttons */
        .edit-btn:hover {
          color: #1e40af !important;
          transform: scale(1.1);
          transition: all 0.2s ease;
        }

        .delete-btn:hover {
          color: #b91c1c !important;
          transform: scale(1.1);
          transition: all 0.2s ease;
        }

        .modern-tabs .nav-tabs {
          border-bottom: 2px solid #f0f4f8;
          margin-bottom: 2rem;
        }

        .modern-tabs .nav-link {
          border: none;
          border-radius: 0.75rem 0.75rem 0 0;
          padding: 1rem 1.5rem;
          font-weight: 600;
          color: #64748b;
          transition: all 0.3s ease;
          margin-right: 0.5rem;
        }

        .modern-tabs .nav-link:hover {
          background: #f8fafc;
          color: #3b82f6;
          border-color: transparent;
        }

        .modern-tabs .nav-link.active {
          background: #eff6ff;
          color: #3b82f6;
          border-color: transparent;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
        }

        .modern-tab-content {
          padding: 1rem 0;
        }

        @media (max-width: 768px) {
          .modern-tabs-container {
            padding: 1rem;
          }
          
          .modern-tabs .nav-link {
            padding: 0.75rem 1rem;
            font-size: 0.9rem;
          }
        }
      `}</style>
    </Col>
  );
};

export default AddUser;
