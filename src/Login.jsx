import React from 'react';
import { Container, Form, Button, Card } from 'react-bootstrap';

const Login = () => {
  return (
    <Container className="d-flex vh-100 justify-content-center align-items-center">
      <Card style={{ width: '24rem', padding: '2rem' }}>
        <h3 className="text-center mb-3">Login</h3>
        <Form>
          <Form.Group className="mb-3" controlId="formEmail">
            <Form.Label>Email address</Form.Label>
            <Form.Control type="email" placeholder="Enter email" />
          </Form.Group>

          <Form.Group className="mb-3" controlId="formPassword">
            <Form.Label>Password</Form.Label>
            <Form.Control type="password" placeholder="Password" />
          </Form.Group>

          <Button variant="primary" type="submit" className="w-100">
            Login
          </Button>
        </Form>
      </Card>
    </Container>
  );
};

export default Login;
