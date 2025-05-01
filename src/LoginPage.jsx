import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import styles from './LoginPage.module.css';
import Logo from "../src/assets/Logo.svg";
import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';


const LoginPage = () => {

  const navigate = useNavigate();

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      console.log("Login Success ✅", tokenResponse);
      // Save token in localStorage
  localStorage.setItem("token", tokenResponse.access_token); // store token
      navigate('/dashboard'); // redirect to dashboard
    },
    onError: () => {
      console.log("Login Failed ❌");
    },
  });

  return (
    <Container fluid className={styles.loginContainer}>
      <Row className="min-vh-100">
        {/* Left Section */}
        <Col xs={12} md={6} className={`${styles.leftSection} d-flex justify-content-center align-items-center`}>
          <Card className={`text-center ${styles.iotCard}`}>
            <Card.Body className={`d-flex align-items-center justify-content-center flex-column`}>
              <img src={Logo} alt="" />
              <Card.Title className={styles.iotText}>
                Your Intelligent IoT Dashboard Gateway
              </Card.Title>
            </Card.Body>
          </Card>
        </Col>

        {/* Right Section */}
        <Col xs={12} md={6} className={`${styles.rightSection} d-flex justify-content-center align-items-center`}>
          <Card className={`text-center ${styles.iotCard2}`}>
            <Card.Body className={`d-flex align-items-center justify-content-center flex-column`}>
              <div className={`${styles.loginPlaceholder} d-flex justify-content-center align-items-center flex-column`}>
                <h3 className={styles.loginTitle}> To Login</h3>
                <Button className={styles.googleButton} onClick={() => login()}>
                  <img
                    src="https://developers.google.com/identity/images/g-logo.png"
                    alt="Google"
                    className={styles.googleIcon}
                  />
                  Sign in with Google
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default LoginPage;
