import React, { useEffect, useState } from 'react';
import { Col, Row, Card } from 'react-bootstrap';
import axios from 'axios';
import styles from "./MainContent.module.css";
import PaymentButton from '../components/PaymentButton'; // ✅ Razorpay button

export default function Subscription() {
  const plans = [
    { name: "Free", price: "₹0", desc: "Basic access with limited features." },
    { name: "Standard", price: "₹99", desc: "Standard plan with core features." },
    { name: "Premium", price: "₹199", desc: "All features unlocked with premium support." }
  ];

  const [subscriptionStatus, setSubscriptionStatus] = useState("inactive");

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await axios.get('/api/subscription/status', { withCredentials: true });
        setSubscriptionStatus(res.data.status); // "active" or "inactive"
      } catch (err) {
        console.error('Failed to fetch subscription status', err);
      }
    };

    fetchStatus();
  }, []);

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main}>
      <div className="mt-4 text-center">
        <h1>Subscription Page</h1>
      </div>

      <Row className="d-flex justify-content-evenly mt-4 h-100">
        {plans.map((plan, idx) => {
          const isFree = plan.name === "Free";
          const isSubscribed = subscriptionStatus === "active";

          const cardClass = isFree
            ? isSubscribed
              ? `${styles.subscriptionCard} ${styles.disabledCard}`
              : `${styles.subscriptionCard} ${styles.selectedCard}`
            : styles.subscriptionCard;

          return (
            <Col key={idx} xs={12} sm={6} md={4} className="mb-4 d-flex justify-content-center">
              <Card className={cardClass}>
                <Card.Body className='text-center'>
                  <Card.Title className={styles.subscriptionTitle}>{plan.name}</Card.Title>
                  <Card.Subtitle className={`my-5 ${styles.subscriptionPrice}`}>{plan.price}</Card.Subtitle>
                  <Card.Text>{plan.desc}</Card.Text>

                  {plan.price !== "₹0" ? (
                    <PaymentButton amount={parseInt(plan.price.replace("₹", ""))} />
                  ) : (
                    ""
                  )}
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>
    </Col>
  );
}
