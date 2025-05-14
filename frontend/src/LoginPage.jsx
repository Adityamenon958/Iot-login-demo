import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Modal, Form } from 'react-bootstrap';
import styles from './LoginPage.module.css';
import Logo from "../src/assets/DashboardLogo.png";
import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { SiGmail } from "react-icons/si";
import { X } from 'lucide-react';
import "./LoginPage.css"

const LoginPage = () => {
  const navigate = useNavigate();
  const [showEmailModal, setShowEmailModal] = useState(false);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      console.log("Login Success ✅", tokenResponse);
      localStorage.setItem("token", tokenResponse.access_token);
      navigate('/dashboard');
    },
    onError: () => {
      console.log("Login Failed ❌");
    },
  });

  const handleEmailLogin = () => {
    setShowEmailModal(true);
  };

  return (
    <>
      <Container fluid className={styles.loginContainer}>
        <Row className="min-vh-100">
          {/* Left Section */}
          <Col xs={12} md={6} className={`${styles.leftSection} d-flex justify-content-center align-items-center`}>
            <Card className={`text-center ${styles.iotCard}`}>
              <Card.Body className="d-flex align-items-center justify-content-center flex-column">
                <img src={Logo} className={styles.loginlogo} />
                <Card.Title className={styles.iotText}>
                  Your Intelligent IoT Dashboard Gateway
                </Card.Title>
              </Card.Body>
            </Card>
          </Col>

          {/* Right Section */}
          <Col xs={12} md={6} className={`${styles.rightSection} d-flex justify-content-center align-items-center`}>
            <Card className={`text-center ${styles.iotCard2}`}>
              <Card.Body className="d-flex align-items-center justify-content-center flex-column">
                <div className={`${styles.loginPlaceholder} d-flex justify-content-center align-items-center flex-column`}>
                  <h3 className={styles.loginTitle}>To Login</h3>

                  <Button className={styles.googleButton} onClick={() => login()}>
                    <img
                      src="https://developers.google.com/identity/images/g-logo.png"
                      alt="Google"
                      className={styles.googleIcon}
                    />
                    Sign in with Google
                  </Button>

                  <h3 className={`${styles.loginTitle} mt-2`}>Or</h3>

                  <Button className={styles.googleButton} onClick={handleEmailLogin}>
                    <SiGmail className={styles.gmailIcon} />
                    Sign in with Email
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Email Login Modal */}
      <Modal
  show={showEmailModal}
  onHide={() => setShowEmailModal(false)}
  centered
  backdrop="static"
  className="custom_modal" 
>
  <Modal.Header
    className="border-0 px-4 pt-4 d-flex justify-content-between align-items-center" // Removes border, adds spacing
  >
    <Modal.Title>Sign in</Modal.Title>
    <Button
      variant="light"
      onClick={() => setShowEmailModal(false)}
      className="border-0"
    >
      <X size={20} />
    </Button>
  </Modal.Header>

  <Modal.Body className="px-4 pb-4">
    <Form>
      <Form.Group controlId="formEmail">
        <Form.Label className="custom_label">Email address</Form.Label>
        <Form.Control type="email" placeholder="Enter email" className="custom_input"/>
      </Form.Group>

      <Form.Group controlId="formPassword" className="mt-3">
        <Form.Label className="custom_label">Password</Form.Label>
        <Form.Control type="password" placeholder="Password" className="custom_input"/>
      </Form.Group>

      <div className="text-end mt-2">
        <a href="#" className="text-decoration-none">Forgot password?</a>
      </div>

      <Button className="w-100 mt-4 signIn" variant="primary" type="submit">
        Sign In
      </Button>
    </Form>
  </Modal.Body>
</Modal>

    </>
  );
};

export default LoginPage;
