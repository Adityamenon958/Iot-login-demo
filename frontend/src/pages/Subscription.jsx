import React from 'react';
import { Col, Row, Card } from 'react-bootstrap';
import styles from "./MainContent.module.css";
import PaymentButton from '../components/PaymentButton'; // ✅ Import Razorpay button

export default function Subscription() {
  const plans = [
    { name: "Free", price: "₹0", desc: "Basic access with limited features." },
    { name: "Standard", price: "₹99", desc: "Standard plan with core features." },
    { name: "Premium", price: "₹199", desc: "All features unlocked with premium support." }
  ];

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main}>
      <div className="mt-4 text-center">
        <h1>Subscription Page</h1>
      </div>

      <Row className="d-flex justify-content-evenly mt-4 h-100">
        {plans.map((plan, idx) => (
          <Col key={idx} xs={12} sm={6} md={4} className="mb-4 d-flex justify-content-center">
            <Card className={styles.subscriptionCard}>
              <Card.Body className='text-center'>
                <Card.Title className={styles.subscriptionTitle}>{plan.name}</Card.Title>
                <Card.Subtitle className={`my-5 ${styles.subscriptionPrice}`}>{plan.price}</Card.Subtitle>
                <Card.Text>{plan.desc}</Card.Text>

                {/* ✅ Show button only for paid plans */}
                {plan.price !== "₹0" ? (
                  <PaymentButton  amount={parseInt(plan.price.replace("₹", ""))} />
                ) : (
                  <button className={styles.subscribeBtn}>Choose Plan</button>
                )}
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Col>
  );
}
