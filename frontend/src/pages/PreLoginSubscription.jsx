import React from 'react';
import { Col, Row, Card } from 'react-bootstrap';
import styles from "./MainContent.module.css";

export default function PreLoginSubscription() {
  const plans = [
    { name: "Free", price: "₹0", desc: "Basic access with limited features." },
    { name: "Standard", price: "₹99", desc: "Standard plan with core features." },
    { name: "Premium", price: "₹199", desc: "All features unlocked with premium support." }
  ];

  return (
    <Col xs={12} md={12} className={`${styles.main2} p-5`}>
      <div className="mt-5 text-center">
        <h1>Choose Your Plan</h1>
        <p className="text-muted">Start with a free plan or upgrade anytime</p>
      </div>

      <Row className="d-flex justify-content-evenly mt-4 h-100">
        {plans.map((plan, idx) => (
          <Col key={idx} xs={12} sm={6} md={4} className="mb-4 d-flex justify-content-center">
            <Card className={styles.subscriptionCard2}>
              <Card.Body className='text-center'>
                <Card.Title className={styles.subscriptionTitle2}>{plan.name}</Card.Title>
                <Card.Subtitle className={`my-4 ${styles.subscriptionPrice2}`}>{plan.price}</Card.Subtitle>
                <Card.Text>{plan.desc}</Card.Text>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Col>
  );
}
