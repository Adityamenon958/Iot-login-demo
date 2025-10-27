import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button } from 'react-bootstrap';
import { Phone, Mail, Send } from 'lucide-react';
import styles from './ContactFooter.module.css';

const ContactFooter = () => {
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    query: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    // TODO: Add form submission logic
    alert('Thank you for your message! We will get back to you soon.');
    setFormData({ name: '', contact: '', query: '' });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className={styles.contactFooter}>
      {/* ✅ Hero Section */}
      <div className={styles.heroSection}>
        <Container>
          <Row className="text-center">
            <Col lg={8} className="mx-auto">
              <h1 className={styles.heroTitle}>Get In Touch</h1>
              <p className={styles.heroDescription}>
                Our clients love working with us for our innovation, reliability, and 
                commitment to excellence. They appreciate how we transform complex IoT data 
                into actionable insights. At IoT Platform, every deployment becomes a success 
                story — one that leaves our clients confident, empowered, and eager to scale.
              </p>
            </Col>
          </Row>
        </Container>
      </div>

      {/* ✅ Contact Information Bar */}
      <div className={styles.contactBar}>
        <Container>
          <Row className="align-items-center">
            <Col md={6}>
              <div className={styles.contactInfo}>
                <Phone size={24} className={styles.contactIcon} />
                <div className={styles.contactText}>
                  <div>Chirag Shah: 9820333179</div>
                  <div>Nilesh Samel: 9819137713</div>
                </div>
              </div>
            </Col>
            <Col md={6}>
              <div className={styles.contactInfo}>
                <Mail size={24} className={styles.contactIcon} />
                <div className={styles.contactText}>
                  <div>aditya.menon@gsnsoln.com</div>
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </div>

      {/* ✅ Contact Form Section */}
      <div className={styles.formSection}>
        <Container>
          <Row>
            <Col lg={5} className="d-none d-lg-block">
              <div className={styles.illustration}>
                <div className={styles.illustrationPlaceholder}>
                  <Phone size={120} className={styles.illustrationIcon} />
                  <p className={styles.illustrationText}>
                    Let's connect and build something amazing together
                  </p>
                </div>
              </div>
            </Col>
            <Col lg={7}>
              <Card className={styles.formCard}>
                <Card.Body className="p-4">
                  <h3 className={styles.formTitle}>Send Us a Message</h3>
                  <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                      <Form.Label className={styles.formLabel}>Name</Form.Label>
                      <Form.Control
                        type="text"
                        name="name"
                        placeholder="Enter your name"
                        value={formData.name}
                        onChange={handleChange}
                        className={styles.formInput}
                        required
                      />
                    </Form.Group>
                    
                    <Form.Group className="mb-3">
                      <Form.Label className={styles.formLabel}>Contact</Form.Label>
                      <Form.Control
                        type="tel"
                        name="contact"
                        placeholder="Enter your contact number"
                        value={formData.contact}
                        onChange={handleChange}
                        className={styles.formInput}
                        required
                      />
                    </Form.Group>
                    
                    <Form.Group className="mb-4">
                      <Form.Label className={styles.formLabel}>Let Us Know</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        name="query"
                        placeholder="Enter your query :)"
                        value={formData.query}
                        onChange={handleChange}
                        className={styles.formInput}
                        required
                      />
                    </Form.Group>
                    
                    <Button type="submit" className={styles.submitButton}>
                      <Send size={20} className="me-2" />
                      Submit
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>

      {/* ✅ Stats Section */}
      <div className={styles.statsSection}>
        <Container>
          <Row className="g-4 text-center justify-content-center">
            <Col xs={12} sm={6} lg={3}>
              <div className={styles.statCard}>
                <div className={styles.statNumber}>500+</div>
                <div className={styles.statLabel}>Active Devices</div>
              </div>
            </Col>
            <Col xs={12} sm={6} lg={3}>
              <div className={styles.statCard}>
                <div className={styles.statNumber}>100+</div>
                <div className={styles.statLabel}>Happy Clients</div>
              </div>
            </Col>
            <Col xs={12} sm={6} lg={3}>
              <div className={styles.statCard}>
                <div className={styles.statNumber}>99.9%</div>
                <div className={styles.statLabel}>Uptime</div>
              </div>
            </Col>
            <Col xs={12} sm={6} lg={3}>
              <div className={styles.statCard}>
                <div className={styles.statNumber}>24/7</div>
                <div className={styles.statLabel}>Support</div>
              </div>
            </Col>
          </Row>
        </Container>
      </div>

      {/* ✅ Footer */}
      <div className={styles.footer}>
        <Container>
          <Row className="align-items-center">
            <Col md={4} className="text-center text-md-start mb-3 mb-md-0">
              <div className={styles.footerLinks}>
                <a href="#home" className={styles.footerLink}>Home</a>
                <a href="#features" className={styles.footerLink}>Features</a>
                <a href="#about" className={styles.footerLink}>About</a>
              </div>
            </Col>
            <Col md={4} className="text-center mb-3 mb-md-0">
              <div className={styles.copyright}>
                © 2025 IoT Platform. All rights reserved.
              </div>
            </Col>
            <Col md={4} className="text-center text-md-end">
              <div className={styles.socialLinks}>
                <a href="#" className={styles.socialLink}>LinkedIn</a>
                <a href="#" className={styles.socialLink}>Twitter</a>
                <a href="#" className={styles.socialLink}>GitHub</a>
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    </div>
  );
};

export default ContactFooter;

