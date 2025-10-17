import React, { useEffect, useRef, useState } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import styles from './FeaturesShowcase.module.css';

const FeaturesShowcase = () => {
  const sectionRef = useRef(null);
  const headerRef = useRef(null);
  const [visibleFeatures, setVisibleFeatures] = useState([]);
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);

  // Debug log for state changes
  useEffect(() => {
    console.log('isHeaderVisible changed:', isHeaderVisible);
  }, [isHeaderVisible]);

  useEffect(() => {
    // ✅ Intersection Observer for header animation
    const headerObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            console.log('Header is visible!', entry.target);
            setIsHeaderVisible(true);
          } else {
            // Reset animation when out of view
            setIsHeaderVisible(false);
          }
        });
      },
      { threshold: 0.2 }
    );

    if (headerRef.current) {
      headerObserver.observe(headerRef.current);
    }

    // ✅ Intersection Observer for feature cards
    const featureObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const featureIndex = parseInt(entry.target.dataset.featureIndex);
            setVisibleFeatures(prev => [...prev, featureIndex]);
          } else {
            // Reset animation when out of view
            const featureIndex = parseInt(entry.target.dataset.featureIndex);
            setVisibleFeatures(prev => prev.filter(index => index !== featureIndex));
          }
        });
      },
      { threshold: 0.3 }
    );

    const featureElements = document.querySelectorAll(`.${styles.featureCard}`);
    featureElements.forEach(el => featureObserver.observe(el));

    return () => {
      headerObserver.disconnect();
      featureObserver.disconnect();
    };
  }, []);

  const features = [
    {
      icon: "📊",
      title: "Real-time Monitoring",
      description: "Get instant insights into your IoT devices with live data streaming and real-time alerts.",
      color: "#4db3b3"
    },
    {
      icon: "🧠",
      title: "Advanced Analytics",
      description: "Leverage AI-powered analytics to predict failures and optimize device performance.",
      color: "#667eea"
    },
    {
      icon: "⚡",
      title: "Easy Setup",
      description: "Deploy and configure your devices in minutes with our intuitive setup wizard.",
      color: "#f093fb"
    },
    {
      icon: "🔒",
      title: "Enterprise Security",
      description: "Bank-grade security with end-to-end encryption and role-based access control.",
      color: "#4facfe"
    },
    {
      icon: "📱",
      title: "Mobile Ready",
      description: "Access your dashboard anywhere with our responsive mobile-first design.",
      color: "#43e97b"
    },
    {
      icon: "🔧",
      title: "Custom Integrations",
      description: "Connect with your existing tools through our robust API and webhook system.",
      color: "#fa709a"
    }
  ];

  return (
    <div className={styles.featuresSection} ref={sectionRef}>
      {/* ✅ Abstract floating shapes */}
      <div className={styles.abstractShapes}>
        <div className={styles.abstractShape1}></div>
        <div className={styles.abstractShape2}></div>
        <div className={styles.abstractShape3}></div>
      </div>
      
      <Container className="py-5" style={{ position: 'relative', zIndex: 3 }}>
        {/* ✅ Section header with scroll animation */}
        <Row className="text-center mb-5">
          <Col lg={8} className="mx-auto">
            <div ref={headerRef} className={styles.headerContainer}>
              <h2 className={`${styles.sectionTitle} ${isHeaderVisible ? styles.titleAnimated : ''}`}>
                Why Choose Our Platform?
              </h2>
              <p className={`${styles.sectionSubtitle} ${isHeaderVisible ? styles.subtitleAnimated : ''}`}>
                Powerful features designed to streamline your IoT operations and boost productivity
              </p>
            </div>
          </Col>
        </Row>

        {/* ✅ Features grid */}
        <Row className="g-4">
          {features.map((feature, index) => (
            <Col key={index} lg={4} md={6} className="mb-4">
              <Card 
                className={`${styles.featureCard} ${
                  visibleFeatures.includes(index) ? styles.featureVisible : ''
                }`}
                data-feature-index={index}
                style={{ 
                  animationDelay: `${index * 0.15}s`,
                  '--feature-color': feature.color,
                  transitionDelay: `${index * 0.1}s`
                }}
              >
                <Card.Body className="text-center p-4">
                  {/* ✅ Feature icon */}
                  <div 
                    className={styles.featureIcon}
                    style={{ backgroundColor: `${feature.color}20` }}
                  >
                    <span className={styles.iconEmoji}>{feature.icon}</span>
                  </div>

                  {/* ✅ Feature content */}
                  <h5 className={styles.featureTitle}>{feature.title}</h5>
                  <p className={styles.featureDescription}>{feature.description}</p>

                  {/* ✅ Hover effect indicator */}
                  <div className={styles.hoverIndicator}></div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        {/* ✅ Bottom CTA */}
        <Row className="mt-5">
          <Col className="text-center">
            <div className={styles.bottomCTA}>
              <p className={styles.ctaText}>
                Ready to experience the difference?
              </p>
              <button className={styles.ctaButton}>
                Start Your Free Trial
              </button>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default FeaturesShowcase;
