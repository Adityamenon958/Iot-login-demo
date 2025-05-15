import React from 'react';
import { Container, Row, Col, Form, Button } from 'react-bootstrap';
import styles from "./MainContent.module.css";
import "./MainContent.css";

const AddUser = () => {
  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main}>
      <div className="p-4">
        <h2 className="mb-4">Add User</h2>
        
        <Form>
          <Form.Group className="mb-3" controlId="formCompanyName">
            <Form.Label className='custom_label'>Company Name</Form.Label>
            <Form.Control type="text" placeholder="Enter company name" className="custom_input"/>
          </Form.Group>

          <Form.Group className="mb-3" controlId="formContactInfo">
            <Form.Label className='custom_label'>Contact Info</Form.Label>
            <Form.Control type="text" placeholder="Enter contact info" className="custom_input"/>
          </Form.Group>

          <Form.Group className="mb-3" controlId="formEmail">
            <Form.Label className='custom_label'>Email ID</Form.Label>
            <Form.Control type="email" placeholder="Enter email" className="custom_input"/>
          </Form.Group>

          <Form.Group className="mb-3" controlId="formPassword">
            <Form.Label className='custom_label'>Password</Form.Label>
            <Form.Control type="password" placeholder="Enter password" className="custom_input"/>
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
