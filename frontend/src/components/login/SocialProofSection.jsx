import React, { useEffect, useRef, useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import styles from './SocialProofSection.module.css';
// ✅ Import background image
import bgImage from '../../assets/bg-image-home.jpg';

const SocialProofSection = () => {
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isTitleVisible, setIsTitleVisible] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [isChanging, setIsChanging] = useState(false);

  const testimonials = [
    {
      name: "Ruhi Siddique",
      role: "IoT Engineer",
      company: "TechSolutions Inc.",
      content: "Best Online Training Ever! Hi I am Ruhi Siddique, levelUP is a very good place to go if you want to learn. I have taken a lot of classes, including IoT classes. In general, they're all very interesting, and the tutors are very good at answering our questions. They are all-natural and can help women start a small business of their own.",
      avatar: "👩‍💻",
      rating: 5
    },
    {
      name: "Sarah Johnson",
      role: "CTO",
      company: "TechCorp Industries",
      content: "This platform transformed our IoT operations. We reduced downtime by 40% and improved efficiency across all our manufacturing facilities. The real-time monitoring capabilities are game-changing.",
      avatar: "👩‍💼",
      rating: 5
    },
    {
      name: "Michael Chen",
      role: "Operations Director",
      company: "SmartManufacturing Co.",
      content: "The real-time monitoring capabilities are game-changing. We can now predict issues before they happen and save thousands in maintenance costs. Easy setup, powerful analytics, and excellent support.",
      avatar: "👨‍💻",
      rating: 5
    }
  ];

  useEffect(() => {
    // ✅ Intersection Observer for section visibility - resets animation every time
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        } else {
          setIsVisible(false); // Reset animation when out of view
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
    // ✅ Separate observer for title animation
    const titleObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsTitleVisible(true);
        } else {
          setIsTitleVisible(false); // Reset title animation when out of view
        }
      },
      { threshold: 0.2 }
    );

    if (titleRef.current) {
      titleObserver.observe(titleRef.current);
    }

    return () => titleObserver.disconnect();
  }, []);

  useEffect(() => {
    // ✅ Auto-rotate testimonials when section is visible
    if (isVisible) {
      const interval = setInterval(() => {
        if (!isChanging) {
          setIsChanging(true);
          setTimeout(() => {
            setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
            setTimeout(() => setIsChanging(false), 100);
          }, 200);
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [isVisible, testimonials.length, isChanging]);

  const nextTestimonial = () => {
    if (isChanging) return; // Prevent rapid clicking
    setIsChanging(true);
    setTimeout(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
      setTimeout(() => setIsChanging(false), 100);
    }, 200);
  };

  const prevTestimonial = () => {
    if (isChanging) return; // Prevent rapid clicking
    setIsChanging(true);
    setTimeout(() => {
      setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
      setTimeout(() => setIsChanging(false), 100);
    }, 200);
  };

  const goToTestimonial = (index) => {
    if (isChanging || index === currentTestimonial) return;
    setIsChanging(true);
    setTimeout(() => {
      setCurrentTestimonial(index);
      setTimeout(() => setIsChanging(false), 100);
    }, 200);
  };

  return (
    <div className={styles.socialProofSection} ref={sectionRef}>
      {/* ✅ Content overlay */}
      <div className={styles.contentOverlay}>
        <Container className="py-5">
          {/* ✅ Section header - moved up */}
          <Row className="text-center mb-4">
            <Col lg={8} className="mx-auto">
              <h2 ref={titleRef} className={`${styles.sectionTitle} ${isTitleVisible ? styles.titleAnimated : ''}`}>
                Trusted by Industry Leaders
              </h2>
              <p className={`${styles.sectionSubtitle} ${isTitleVisible ? styles.subtitleAnimated : ''}`}>
                Join thousands of companies already using our platform to optimize their IoT operations.
              </p>
            </Col>
          </Row>

          {/* ✅ Testimonial carousel */}
          <Row>
            <Col lg={8} className="mx-auto">
              <div className={styles.testimonialsContainer}>
                {/* ✅ Navigation arrows */}
                <button className={styles.navArrow} onClick={prevTestimonial}>
                  ‹
                </button>
                
                <div className={`${styles.testimonialCard} ${isChanging ? styles.cardChanging : styles.cardVisible}`}>
                  <div className={styles.testimonialContent}>
                    {/* ✅ Profile picture */}
                    <div className={styles.profilePicture}>
                      {testimonials[currentTestimonial].avatar}
                    </div>
                    
                    {/* ✅ Name */}
                    <div className={styles.testimonialName}>
                      {testimonials[currentTestimonial].name}
                    </div>
                    
                    {/* ✅ Testimonial text */}
                    <div className={styles.testimonialText}>
                      "{testimonials[currentTestimonial].content}"
                    </div>
                    
                    {/* ✅ Rating stars */}
                    <div className={styles.rating}>
                      {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                        <span key={i} className={styles.star}>⭐</span>
                      ))}
                    </div>
                  </div>
                </div>

                <button className={styles.navArrow} onClick={nextTestimonial}>
                  ›
                </button>
              </div>

              {/* ✅ Testimonial indicators */}
              <div className={styles.testimonialIndicators}>
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    className={`${styles.indicator} ${
                      index === currentTestimonial ? styles.indicatorActive : ''
                    }`}
                    onClick={() => goToTestimonial(index)}
                  />
                ))}
              </div>
            </Col>
          </Row>
        </Container>
      </div>
    </div>
  );
};

export default SocialProofSection;
