import React, { useEffect, useRef, useState } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import styles from './HeroSection.module.css';

const HeroSection = () => {
  const heroRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // ✅ Intersection Observer for section visibility
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (heroRef.current) {
      observer.observe(heroRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // ✅ Parallax scroll effect for background elements
    const handleScroll = () => {
      const scrolled = window.pageYOffset;
      const parallaxElements = document.querySelectorAll(`.${styles.parallaxElement}`);
      
      parallaxElements.forEach((element, index) => {
        const speed = 0.5 + (index * 0.1); // Different speeds for layered effect
        element.style.transform = `translateY(${scrolled * speed}px)`;
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ✅ Product images data
  const productImages = [
    {
      src: "/src/assets/hero-dashboard.png",
      alt: "IoT Dashboard - Real-time Monitoring",
      title: "Real-time Dashboard",
      description: "Monitor all your devices in one place"
    },
    {
      src: "/src/assets/hero-mobile-left.png",
      alt: "Mobile IoT App Interface",
      title: "Mobile Access",
      description: "View your IoT devices on the go"
    },
    {
      src: "/src/assets/hero-analytics.png",
      alt: "Analytics and Insights",
      title: "Smart Analytics",
      description: "Get insights and predictions from your data"
    }
  ];

  return (
    <div className={styles.heroSection} ref={heroRef}>
      {/* ✅ Enhanced animated background elements */}
      <div className={styles.backgroundElements}>
        <div className={`${styles.parallaxElement} ${styles.floatingIcon1}`}>
          <div className={styles.iotIcon}>📡</div>
        </div>
        <div className={`${styles.parallaxElement} ${styles.floatingIcon2}`}>
          <div className={styles.iotIcon}>🔧</div>
        </div>
        <div className={`${styles.parallaxElement} ${styles.floatingIcon3}`}>
          <div className={styles.iotIcon}>⚡</div>
        </div>
        <div className={`${styles.parallaxElement} ${styles.floatingIcon4}`}>
          <div className={styles.iotIcon}>📊</div>
        </div>
        <div className={`${styles.parallaxElement} ${styles.floatingIcon5}`}>
          <div className={styles.iotIcon}>🌐</div>
        </div>
        <div className={`${styles.parallaxElement} ${styles.floatingIcon6}`}>
          <div className={styles.iotIcon}>🔐</div>
        </div>
      </div>

      <Container className="h-100 d-flex align-items-center">
        <Row className="w-100 align-items-center">
          {/* ✅ Left side - Content */}
          <Col lg={6} className={styles.contentColumn}>
            <div className={styles.contentWrapper}>
              {/* ✅ Main headline with enhanced animation */}
              <h1 className={`${styles.heroTitle} ${isVisible ? styles.titleVisible : ''}`}>
                Transform Your IoT Operations
              </h1>
              
              {/* ✅ Subheadline with staggered animation */}
              <p className={`${styles.heroSubtitle} ${isVisible ? styles.subtitleVisible : ''}`}>
                Monitor, analyze, and optimize your devices in real-time with our intelligent dashboard platform
              </p>
              
              {/* ✅ CTA buttons with hover effects */}
              <div className={`${styles.ctaButtons} ${isVisible ? styles.buttonsVisible : ''}`}>
                <Button className={styles.primaryCTA}>
                  Get Started Free
                </Button>
                <Button variant="outline" className={styles.secondaryCTA}>
                  Watch Demo
                </Button>
              </div>

              {/* ✅ Trust indicators */}
              <div className={`${styles.trustIndicators} ${isVisible ? styles.trustVisible : ''}`}>
                <div className={styles.trustItem}>
                  <span className={styles.trustNumber}>500+</span>
                  <span className={styles.trustLabel}>Devices Monitored</span>
                </div>
                <div className={styles.trustItem}>
                  <span className={styles.trustNumber}>99.9%</span>
                  <span className={styles.trustLabel}>Uptime</span>
                </div>
                <div className={styles.trustItem}>
                  <span className={styles.trustNumber}>24/7</span>
                  <span className={styles.trustLabel}>Support</span>
                </div>
              </div>
            </div>
          </Col>

          {/* ✅ Right side - Product Images */}
          <Col lg={6} className={styles.imagesColumn}>
            <div className={`${styles.imagesWrapper} ${isVisible ? styles.imagesVisible : ''}`}>
              {productImages.map((image, index) => (
                <div 
                  key={index} 
                  className={`${styles.imageCard} ${styles[`imageCard${index + 1}`]}`}
                  style={{ animationDelay: `${0.9 + (index * 0.2)}s` }}
                >
                  <div className={styles.imageContainer}>
                    <img 
                      src={image.src} 
                      alt={image.alt}
                      className={styles.productImage}
                      loading="lazy"
                    />
                    <div className={styles.imageOverlay}>
                      <div className={styles.imageTitle}>{image.title}</div>
                      <div className={styles.imageDescription}>{image.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Col>
        </Row>
      </Container>

      {/* ✅ Scroll indicator */}
      <div className={styles.scrollIndicator}>
        <div className={styles.scrollArrow}></div>
        <span className={styles.scrollText}>Scroll to explore</span>
      </div>
    </div>
  );
};

export default HeroSection;
