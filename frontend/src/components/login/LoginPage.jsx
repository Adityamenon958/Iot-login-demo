import React, { useState } from 'react';
import { Container, Row, Col, Card, Button, Modal, Form, Alert } from 'react-bootstrap';
import styles from './LoginPage.module.css';
import Logo from "../../assets/DashboardLogo.png";
import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { SiGmail } from "react-icons/si";
import { X } from 'lucide-react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { validateEmail } from '../../lib/validation';
import "./LoginPage.css";
import axios from 'axios';

const LoginPage = ({ selectedPlan }) => {
  const navigate = useNavigate();
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // ✅ Validation state management
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ Updated Google Login flow
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      console.log("Google Login Success ✅", tokenResponse);

      try {
        const response = await axios.post(
          '/api/auth/google-login',
          { access_token: tokenResponse.access_token },
          { withCredentials: true } // Send and receive cookies
        );

        console.log("Google Login Verified ✅", response.data);

        // Optional: verify token payload again
        const res2 = await axios.get('/api/auth/userinfo', { withCredentials: true });
        console.log("Verified User Info ✅", res2.data);

        // ✅ Redirect to dashboard - RouteGuard will handle smart redirect if home is disabled
        navigate('/dashboard');
      } catch (error) {
        console.error("Google Login Backend Error ❌", error.response?.data?.message || error.message);
        
        // ✅ Show specific error message from backend
        if (error.response?.status === 403 && error.response?.data?.message) {
          alert(error.response.data.message); // Shows "Account is deactivated. Please contact your administrator."
        } else if (error.response?.status === 401 && error.response?.data?.message) {
          alert(error.response.data.message); // Shows "Invalid credentials ❌"
        } else {
        alert("Google login failed");
        }
      }
    },
    onError: () => {
      console.log("Google Login Failed ❌");
      alert("Google login failed");
    },
  });

  const handleEmailLogin = () => {
    setShowEmailModal(true);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // ✅ Validation functions with sanitization
  const validateEmailField = (emailValue) => {
    // ✅ Email is already sanitized (trimmed and lowercased) in handleEmailChange
    if (!emailValue) {
      setEmailError('Email is required');
      return false;
    }
    
    const emailValidation = validateEmail(emailValue);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.message);
      return false;
    }
    
    setEmailError('');
    return true;
  };

  const validatePasswordField = (passwordValue) => {
    // ✅ Password is already sanitized (trimmed) in handlePasswordChange
    if (!passwordValue) {
      setPasswordError('Password is required');
      return false;
    }
    
    setPasswordError('');
    return true;
  };

  const validateForm = (emailValue = email, passwordValue = password) => {
    const isEmailValid = validateEmailField(emailValue);
    const isPasswordValid = validatePasswordField(passwordValue);
    const formValid = isEmailValid && isPasswordValid;
    setIsFormValid(formValid);
    return formValid;
  };

  // ✅ Handle input changes with real-time validation and sanitization
  const handleEmailChange = (e) => {
    // ✅ Sanitize email: trim spaces and convert to lowercase
    const value = e.target.value.trim().toLowerCase();
    setEmail(value);
    validateEmailField(value);
    // ✅ Pass values directly to avoid timing issues
    validateForm(value, password);
  };

  const handlePasswordChange = (e) => {
    // ✅ For password, we'll trim spaces but preserve case sensitivity
    // (Some systems allow spaces in passwords, others don't - we'll trim for consistency)
    const value = e.target.value.trim();
    setPassword(value);
    validatePasswordField(value);
    // ✅ Pass values directly to avoid timing issues
    validateForm(email, value);
  };

  const handleEmailLoginSubmit = async (e) => {
    e.preventDefault();
    
    // ✅ Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // ✅ Send sanitized data to backend
      const sanitizedEmail = email.trim().toLowerCase();
      const sanitizedPassword = password.trim();
      
      const response = await axios.post(
        '/api/login',
        { email: sanitizedEmail, password: sanitizedPassword },
        { withCredentials: true }
      );
  
      console.log("Login Response ✅", response.data);
  
      const res2 = await axios.get('/api/auth/userinfo', { withCredentials: true });
      console.log("Verified User Info ✅", res2.data);
  
      // ✅ Redirect to dashboard - RouteGuard will handle smart redirect if home is disabled
      navigate('/dashboard');
    } catch (error) {
      console.error("Login Failed ❌", error.response?.data?.message || error.message);
      
      // ✅ Show specific error message from backend
      if (error.response?.status === 403 && error.response?.data?.message) {
        alert(error.response.data.message); // Shows "Account is deactivated. Please contact your administrator."
      } else if (error.response?.status === 401 && error.response?.data?.message) {
        alert(error.response.data.message); // Shows "Invalid credentials ❌"
      } else {
      alert("Invalid login");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Container fluid className={styles.loginContainer}>
        <Row className="min-vh-100">
          <Col xs={12} md={6} className={`${styles.leftSection} d-flex justify-content-center align-items-center`}>
            <Card className={`text-center ${styles.iotCard}`}>
              <Card.Body className="d-flex align-items-center justify-content-center flex-column">
                <img src={Logo} className={styles.loginlogo} />
                <Card.Title className={styles.iotText}>
                  Your Intelligent IoT Dashboard Gateway
                </Card.Title>
                
                {/* ✅ Plan selection context */}
                {selectedPlan && (
                  <div 
                    style={{
                      marginTop: '1rem',
                      padding: '0.75rem 1.5rem',
                      background: 'linear-gradient(135deg, rgba(77, 179, 179, 0.1) 0%, rgba(77, 179, 179, 0.05) 100%)',
                      borderRadius: '15px',
                      border: '2px solid rgba(77, 179, 179, 0.3)',
                      color: '#4db3b3',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      animation: 'fadeIn 0.8s ease-out'
                    }}
                  >
                    🎯 Ready to start with your <strong>{selectedPlan}</strong> plan!
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} md={6} className={`${styles.rightSection} d-flex justify-content-center align-items-center`}>
            <Card className={`text-center ${styles.iotCard2}`}>
              <Card.Body className="d-flex align-items-center justify-content-center flex-column">
                <div className={`${styles.loginPlaceholder} d-flex justify-content-center align-items-center flex-column`}>
                  <h3 className={styles.loginTitle}>To Login</h3>
                  {/* 🚫 Google Login temporarily disabled */}
                  {/* <Button className={styles.googleButton} onClick={() => login()}>
                    <img
                      src="https://developers.google.com/identity/images/g-logo.png"
                      alt="Google"
                      className={styles.googleIcon}
                    />
                    Sign in with Google
                  </Button> */}

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
        <Modal.Header className="border-0 d-flex justify-content-between align-items-center">
          <Modal.Title>Sign in</Modal.Title>
          <button 
            onClick={() => setShowEmailModal(false)} 
            className="btn-close"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </Modal.Header>

        <Modal.Body className="px-4 pb-4">
          <Form onSubmit={handleEmailLoginSubmit}>
            <Form.Group controlId="formEmail">
              <Form.Label className="custom_label">Email address</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter email"
                className={`custom_input ${emailError ? 'is-invalid' : ''}`}
                value={email}
                onChange={handleEmailChange}
                isInvalid={!!emailError}
              />
              {emailError && (
                <Form.Control.Feedback type="invalid" className="d-block">
                  {emailError}
                </Form.Control.Feedback>
              )}
            </Form.Group>

            <Form.Group controlId="formPassword" className="mt-3">
              <Form.Label className="custom_label">Password</Form.Label>
              <div className="password-input-wrapper">
                <Form.Control
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className={`custom_input password-input ${passwordError ? 'password-input-error' : ''}`}
                  value={password}
                  onChange={handlePasswordChange}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </div>
              {passwordError && (
                <div className="password-error-feedback">
                  {passwordError}
                </div>
              )}
            </Form.Group>

            <div className="text-end mt-2">
              <a href="#" className="text-decoration-none">Forgot password?</a>
            </div>

            <Button 
              className="w-100 mt-4 signIn" 
              variant="primary" 
              type="submit"
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default LoginPage;
