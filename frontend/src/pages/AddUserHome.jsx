import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Col, Row, Form, Button, Spinner, Modal } from 'react-bootstrap';
import styles from "./MainContent.module.css";
import "./MainContent.css";

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

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await axios.post('/api/users', formData, { withCredentials: true });
      alert(res.data.message);
      setFormData({
        companyName: formData.companyName,
        contactInfo: '',
        email: '',
        password: '',
        role: 'user',
        name: '',
      });
      fetchUsers(formData.companyName);
      setShowModal(false);
    } catch (err) {
      console.error(err.response?.data || err.message);
      alert(err.response?.data?.message || "Something went wrong ❌");
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

      {/* Modal for Add User Form */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered className="custom_modal1">
        <Modal.Header closeButton className="border-0 px-4 pt-4 pb-0 d-flex justify-content-between align-items-center">
          <Modal.Title>Add New User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label className='custom_label1'>Full Name</Form.Label>
              <Form.Control type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Enter Full name" className="custom_input1" />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className='custom_label1'>Contact Info</Form.Label>
              <Form.Control type="text" name="contactInfo" value={formData.contactInfo} onChange={handleChange} placeholder="Enter contact info" className="custom_input1" />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className='custom_label1'>Email ID</Form.Label>
              <Form.Control type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter email" className="custom_input1" />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className='custom_label1'>Password</Form.Label>
              <Form.Control type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Enter password" className="custom_input1" />
            </Form.Group>
            <Button variant="primary" type="submit" className="w-100 signIn1 mb-2">
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
