import React, { useState } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import styles from './SubscriptionSection.module.css';

const SubscriptionSection = () => {
  const [clickedPlan, setClickedPlan] = useState(null);

  const plans = [
    { name: "Free", price: "₹0", desc: "Free plan always available for testing and demo.", color: "#e3f2fd" },
    { name: "Standard", price: "₹99", desc: "Standard plan with core features.", color: "#f3e5f5" },
    { name: "Premium", price: "₹199", desc: "All features unlocked with premium support.", color: "#e8f5e9" }
  ];

  const handlePlanClick = (planName) => {
    setClickedPlan(planName);
    
    const event = new CustomEvent('planSelected', { 
      detail: { planName, timestamp: Date.now() } 
    });
    window.dispatchEvent(event);
    
    const loginSection = document.querySelector('.carousel-slide:first-child');
    if (loginSection) {
      loginSection.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
      
      setTimeout(() => {
        setClickedPlan(null);
      }, 1500);
    }
  };

  return (
    <div className={styles.subscriptionSection}>
      <Container className="py-5">
        <Row className="text-center mb-5">
          <Col lg={8} className="mx-auto">
            <h1 className={styles.sectionTitle}>Power Up Your Dashboard Experience</h1>
            <p className={styles.sectionSubtitle}>Start with a free plan or upgrade anytime</p>
          </Col>
        </Row>

        <Row className="g-4 justify-content-center">
          {plans.map((plan, idx) => (
            <Col key={idx} xs={12} sm={6} lg={4} className="d-flex justify-content-center">
              <Card 
                className={`${styles.subscriptionCard} ${clickedPlan === plan.name ? styles.clicked : ''}`}
                onClick={() => handlePlanClick(plan.name)}
                style={{ backgroundColor: plan.color }}
              >
                <Card.Body className="text-center p-4">
                  <h3 className={styles.cardTitle}>{plan.name}</h3>
                  <div className={styles.cardPrice}>{plan.price}</div>
                  <p className={styles.cardDescription}>{plan.desc}</p>
                  <div className={styles.cardHint}>
                    👆 Click to get started
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>
    </div>
  );
};

export default SubscriptionSection;

