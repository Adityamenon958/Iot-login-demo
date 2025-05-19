import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Row, Col, Form, Button } from 'react-bootstrap';
import styles from "./MainContent.module.css";
import "./MainContent.css";



const AddUser = () => {

  const [formData, setFormData] = useState({
    companyName: '',
    contactInfo: '',
    email: '',
    password: '',
    role: 'admin', 
    name: '',
  });

  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchUsers();
  }, []);
  
  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users');
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users:", err.message);
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
        companyName: '',
        contactInfo: '',
        email: '',
        password: '',
        role: 'admin', 
        name: '',
      });
      fetchUsers(); // refresh list after add

    } catch (err) {
      console.error(err.response?.data || err.message);
      alert(err.response?.data?.message || "Something went wrong ❌");
    }
  };



  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main}>
      <Row>
        
      <div className="p-4">
        <h2 className="mb-4">Add Company</h2>
        
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3" controlId="formName">
            <Form.Label className='custom_label'> Full Name</Form.Label>
            <Form.Control type="text" placeholder="Enter Full name" name="name" value={formData.name} onChange={handleChange} className="custom_input"/>
          </Form.Group>

          <Form.Group className="mb-3" controlId="formCompanyName">
            <Form.Label className='custom_label'>Company Name</Form.Label>
            <Form.Control type="text" placeholder="Enter company name" name="companyName" value={formData.companyName} onChange={handleChange} className="custom_input"/>
          </Form.Group>

          <Form.Group className="mb-3" controlId="formContactInfo">
            <Form.Label className='custom_label'>Contact Info</Form.Label>
            <Form.Control type="text" name="contactInfo" value={formData.contactInfo} onChange={handleChange} placeholder="Enter contact info" className="custom_input"/>
          </Form.Group>

          <Form.Group className="mb-3" controlId="formEmail">
            <Form.Label className='custom_label'>Email ID</Form.Label>
            <Form.Control type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Enter email" className="custom_input"/>
          </Form.Group>

          <Form.Group className="mb-3" controlId="formPassword">
            <Form.Label className='custom_label'>Password</Form.Label>
            <Form.Control type="password" name="password" value={formData.password} onChange={handleChange} placeholder="Enter password" className="custom_input"/>
          </Form.Group>

          <Button variant="primary" type="submit" className="custom_AddBtn">
            Add User
          </Button>
        </Form>
      </div>
      </Row>
      <Row>
      <div className="p-4 table2Scroll">
    <h3 className="mb-3">Users List</h3>
    <table className="table table-striped align-middle text-nowrap">
      <thead>
        <tr>
          <th><input type="checkbox" /></th>
          <th>Company Name</th>
          <th>Name</th>
          <th>Contact</th>
          <th>Email ID</th>
          <th>Password</th>
          <th>Toggle</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => (
          <tr key={user._id}>
            <td className="truncate-cell"><input type="checkbox" /></td>
            <td className="truncate-cell">{user.companyName || '-'}</td>
            <td className="truncate-cell">{user.name || '-'}</td>
            <td className="truncate-cell">{user.contactInfo || '-'}</td>
            <td className="truncate-cell">{user.email}</td>
            <td className="truncate-cell">{user.role}</td>
            <td>
              <Form.Check 
                type="switch" 
                id={`toggle-${user._id}`} 
                label="" 
                // You can add toggle handler here later
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
      </Row>
    </Col>
  );
};

export default AddUser;
