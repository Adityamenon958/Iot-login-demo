import React, { useEffect, useRef, useState } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import styles from './SocialProofSection.module.css';

const SocialProofSection = () => {
  const sectionRef = useRef(null);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "CTO, TechCorp",
      company: "TechCorp Industries",
      content: "This platform transformed our IoT operations. We reduced downtime by 40% and improved efficiency across all our manufacturing facilities.",
      avatar: "👩‍💼",
      rating: 5
    },
    {
      name: "Michael Chen",
      role: "Operations Director",
      company: "SmartManufacturing Co.",
      content: "The real-time monitoring capabilities are game-changing. We can now predict issues before they happen and save thousands in maintenance costs.",
      avatar: "👨‍💻",
      rating: 5
    },
    {
      name: "Emily Rodriguez",
      role: "IoT Engineer",
      company: "InnovateTech Solutions",
      content: "Easy setup, powerful analytics, and excellent support. This is exactly what we needed to scale our IoT infrastructure effectively.",
      avatar: "👩‍🔬",
      rating: 5
    }
  ];

  const companies = [
    { name: "TechCorp", logo: "🏢" },
    { name: "SmartManufacturing", logo: "🏭" },
    { name: "InnovateTech", logo: "💡" },
    { name: "DataFlow Inc", logo: "📊" },
    { name: "CloudSystems", logo: "☁️" },
    { name: "IoT Solutions", logo: "🔗" }
  ];

  const stats = [
    { number: "500+", label: "Devices Monitored" },
    { number: "99.9%", label: "Uptime Guarantee" },
    { number: "24/7", label: "Support Available" },
    { number: "50+", label: "Countries Served" }
  ];

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

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // ✅ Auto-rotate testimonials when section is visible
    if (isVisible) {
      const interval = setInterval(() => {
        setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
      }, 4000);

      return () => clearInterval(interval);
    }
  }, [isVisible, testimonials.length]);

  return (
    <div className={styles.socialProofSection} ref={sectionRef}>
      <Container className="py-5">
        {/* ✅ Section header */}
        <Row className="text-center mb-5">
          <Col lg={8} className="mx-auto">
            <h2 className={styles.sectionTitle}>
              Trusted by Industry Leaders
            </h2>
            <p className={styles.sectionSubtitle}>
              Join thousands of companies already using our platform to optimize their IoT operations
            </p>
          </Col>
        </Row>

        {/* ✅ Stats section */}
        <Row className="mb-5">
          <Col className="text-center">
            <div className={`${styles.statsContainer} ${isVisible ? styles.statsVisible : ''}`}>
              {stats.map((stat, index) => (
                <div 
                  key={index} 
                  className={styles.statItem}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className={styles.statNumber}>{stat.number}</div>
                  <div className={styles.statLabel}>{stat.label}</div>
                </div>
              ))}
            </div>
          </Col>
        </Row>

        {/* ✅ Company logos */}
        <Row className="mb-5">
          <Col className="text-center">
            <div className={styles.companiesSection}>
              <p className={styles.companiesTitle}>Trusted by leading companies</p>
              <div className={styles.companiesGrid}>
                {companies.map((company, index) => (
                  <div 
                    key={index} 
                    className={styles.companyLogo}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <span className={styles.companyEmoji}>{company.logo}</span>
                    <span className={styles.companyName}>{company.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </Col>
        </Row>

        {/* ✅ Testimonials carousel */}
        <Row>
          <Col lg={8} className="mx-auto">
            <div className={styles.testimonialsContainer}>
              <div className={styles.testimonialCard}>
                <div className={styles.testimonialContent}>
                  <div className={styles.testimonialText}>
                    "{testimonials[currentTestimonial].content}"
                  </div>
                  
                  {/* ✅ Rating stars */}
                  <div className={styles.rating}>
                    {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                      <span key={i} className={styles.star}>⭐</span>
                    ))}
                  </div>

                  {/* ✅ Author info */}
                  <div className={styles.authorInfo}>
                    <div className={styles.authorAvatar}>
                      {testimonials[currentTestimonial].avatar}
                    </div>
                    <div className={styles.authorDetails}>
                      <div className={styles.authorName}>
                        {testimonials[currentTestimonial].name}
                      </div>
                      <div className={styles.authorRole}>
                        {testimonials[currentTestimonial].role}
                      </div>
                      <div className={styles.authorCompany}>
                        {testimonials[currentTestimonial].company}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ✅ Testimonial indicators */}
              <div className={styles.testimonialIndicators}>
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    className={`${styles.indicator} ${
                      index === currentTestimonial ? styles.indicatorActive : ''
                    }`}
                    onClick={() => setCurrentTestimonial(index)}
                  />
                ))}
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default SocialProofSection;
