import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Col, Row, Form, Button, Spinner, Modal } from 'react-bootstrap';
import styles from "./MainContent.module.css";
import "./MainContent.css";

export default function AddUserHome() {
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
  const [showModal, setShowModal] = useState(false); // ✅ Modal toggle

  useEffect(() => {
    const adminCompany = localStorage.getItem("companyName");
    setFormData((prev) => ({
      ...prev,
      companyName: adminCompany || '',
    }));

    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const companyName = localStorage.getItem("companyName");

    try {
      const res = await axios.get('/api/users', {
        params: { companyName }
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
      const res = await axios.post('/api/users', formData);
      alert(res.data.message);
      setFormData({
        companyName: localStorage.getItem("companyName") || '',
        contactInfo: '',
        email: '',
        password: '',
        role: 'user',
        name: '',
      });
      fetchUsers(); // Refresh table
      setShowModal(false); // Close modal
    } catch (err) {
      console.error(err.response?.data || err.message);
      alert(err.response?.data?.message || "Something went wrong ❌");
    }
  };

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={`${styles.main} p-4`}>
      <Row className="justify-content-between d-flex align-items-start flex-column justify-content-evenly">
        <Col><h2 className="mb-4">User Management</h2></Col>
        <Col  xs="auto">
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
            <Form.Group className="mb-3" controlId="formName">
              <Form.Label className='custom_label1'>Full Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter Full name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="custom_input1"
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formContactInfo">
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

            <Form.Group className="mb-3" controlId="formEmail">
              <Form.Label className='custom_label1'>Email ID</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email"
                className="custom_input1"
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formPassword">
              <Form.Label className='custom_label1'>Password</Form.Label>
              <Form.Control
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter password"
                className="custom_input1"
              />
            </Form.Group>

            <Button variant="primary" type="submit" className="w-100 signIn1 mb-2">
              Submit
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Users Table */}
      <Row >
        <div className="p-4 ps-3 table2Scroll" style={{ position: 'relative', minHeight: '250px' }}>
          <h3 className="mb-3">Users List</h3>

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
                  <th><input type="checkbox" /></th>
                  <th>Company Name</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Email ID</th>
                  <th>Password</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id}>
                    <td><input type="checkbox" /></td>
                    <td>{user.companyName || '-'}</td>
                    <td>{user.name || '-'}</td>
                    <td>{user.contactInfo || '-'}</td>
                    <td>{user.email}</td>
                    <td>{user.password}</td>
                    <td>
                      <Form.Check
                        type="switch"
                        id={`toggle-${user._id}`}
                        label=""
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Row>
    </Col>
  );
}
