import React, { useState } from 'react';
import { Col, Row, Card } from 'react-bootstrap';
import styles from "./MainContent.module.css";

export default function PreLoginSubscription() {
  const [clickedPlan, setClickedPlan] = useState(null);
  const [isScrolling, setIsScrolling] = useState(false);

  const plans = [
    { name: "Free", price: "₹0", desc: "Free plan always available for testing and demo." },
    { name: "Standard", price: "₹99", desc: "Standard plan with core features." },
    { name: "Premium", price: "₹199", desc: "All features unlocked with premium support." }
  ];

  // ✅ Handle plan click with smooth scroll to login form
  const handlePlanClick = (planName) => {
    setClickedPlan(planName);
    setIsScrolling(true);
    
    // Add click animation
    const event = new CustomEvent('planSelected', { 
      detail: { planName, timestamp: Date.now() } 
    });
    window.dispatchEvent(event);
    
    // Smooth scroll to login form (first slide)
    const loginSection = document.querySelector('.carousel-slide:first-child');
    if (loginSection) {
      loginSection.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
      
      // Reset states after scroll completes
      setTimeout(() => {
        setIsScrolling(false);
        setClickedPlan(null);
      }, 1500);
    }
  };

  return (
    <Col xs={12} md={12} className={`${styles.main2} p-5`}>
      <div className="mt-5 text-center">
        <h1>Power Up Your Dashboard Experience</h1>
        <p className="text-muted">Start with a free plan or upgrade anytime</p>
      </div>

      <Row className="d-flex justify-content-evenly mt-4 h-100">
        {plans.map((plan, idx) => {
          const isClicked = clickedPlan === plan.name;
          const isCurrentlyScrolling = isScrolling && clickedPlan === plan.name;
          
          return (
            <Col key={idx} xs={12} sm={6} md={4} className="mb-4 d-flex justify-content-center">
              <Card 
                className={`${styles.subscriptionCard2} ${isClicked ? styles.clickedCard : ''} ${isCurrentlyScrolling ? styles.scrollingCard : ''}`}
                onClick={() => handlePlanClick(plan.name)}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  if (!isCurrentlyScrolling) {
                    e.currentTarget.style.transform = 'scale(1.05) translateY(-8px)';
                    e.currentTarget.style.boxShadow = '0 20px 40px rgba(77, 179, 179, 0.25)';
                    e.currentTarget.style.border = '2px solid #4db3b3';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCurrentlyScrolling) {
                    e.currentTarget.style.transform = 'scale(1) translateY(0)';
                    e.currentTarget.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.border = 'none';
                  }
                }}
              >
                {/* ✅ Click animation overlay */}
                {isClicked && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(135deg, rgba(77, 179, 179, 0.1) 0%, rgba(77, 179, 179, 0.05) 100%)',
                      zIndex: 1,
                      animation: 'clickPulse 0.6s ease-out'
                    }}
                  />
                )}
                
                {/* ✅ Scrolling indicator */}
                {isCurrentlyScrolling && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 2,
                      background: 'rgba(77, 179, 179, 0.9)',
                      color: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '20px',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      animation: 'fadeInOut 1.5s ease-in-out'
                    }}
                  >
                    🚀 Taking you to login...
                  </div>
                )}
                
                <Card.Body 
                  className='text-center' 
                  style={{ 
                    position: 'relative', 
                    zIndex: 1,
                    pointerEvents: isCurrentlyScrolling ? 'none' : 'auto'
                  }}
                >
                  <Card.Title className={styles.subscriptionTitle2}>{plan.name}</Card.Title>
                  <Card.Subtitle className={`my-4 ${styles.subscriptionPrice2}`}>{plan.price}</Card.Subtitle>
                  <Card.Text>{plan.desc}</Card.Text>
                  
                  {/* ✅ Click to login hint */}
                  <div 
                    style={{
                      marginTop: '1rem',
                      fontSize: '0.85rem',
                      color: '#4db3b3',
                      fontWeight: '500',
                      opacity: isCurrentlyScrolling ? 0 : 0.8,
                      transition: 'opacity 0.3s ease'
                    }}
                  >
                    👆 Click to get started
                  </div>
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>
    </Col>
  );
}
