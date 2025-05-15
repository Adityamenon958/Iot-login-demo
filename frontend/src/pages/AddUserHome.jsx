import React, { useState } from 'react';
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
    role: 'admin' 
  });

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
    } catch (err) {
      console.error(err.response?.data || err.message);
      alert(err.response?.data?.message || "Something went wrong ❌");
    }
  };

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main}>
      <div className="p-4">
        <h2 className="mb-4">Add User</h2>
        
        <Form onSubmit={handleSubmit}>
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
    </Col>
  );
};

export default AddUser;
