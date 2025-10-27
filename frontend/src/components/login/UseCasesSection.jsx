import React, { useEffect, useRef, useState } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { 
  Droplets, 
  Warehouse, 
  TrendingUp,
  Factory,
  Leaf,
  Truck,
  Zap,
  Eye,
  Shield,
  BarChart3
} from 'lucide-react';
import styles from './UseCasesSection.module.css';

const UseCasesSection = () => {
  const sectionRef = useRef(null);
  const [visibleCards, setVisibleCards] = useState([]);

  const useCases = [
    {
      title: "Level Sensor Monitoring",
      description: "Real-time water tank and reservoir level tracking with instant alerts",
      benefit: "Prevent overflow and optimize water usage",
      icon: Droplets,
      category: "implemented",
      backgroundImage: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80"
    },
    {
      title: "Crane Safety Monitoring",
      description: "Track crane activity, location, and safety metrics in real-time",
      benefit: "Enhance workplace safety and operational efficiency",
      icon: Warehouse,
      category: "implemented",
      backgroundImage: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80"
    },
    {
      title: "Elevator Management",
      description: "Monitor elevator performance, usage patterns, and maintenance needs",
      benefit: "Reduce downtime and improve passenger safety",
      icon: TrendingUp,
      category: "implemented",
      backgroundImage: "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800&q=80"
    },
    {
      title: "Fleet Management",
      description: "GPS tracking, fuel monitoring, and vehicle health diagnostics",
      benefit: "Optimize routes and reduce operational costs",
      icon: Truck,
      category: "additional",
      backgroundImage: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80"
    },
    {
      title: "Smart Energy Monitoring",
      description: "Track energy consumption, identify waste, and optimize usage",
      benefit: "Reduce costs by up to 30% with intelligent insights",
      icon: Zap,
      category: "additional",
      backgroundImage: "https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=800&q=80"
    },
    {
      title: "Smart Agriculture",
      description: "Monitor soil moisture, temperature, and crop health with sensors",
      benefit: "Increase yield and reduce water waste",
      icon: Leaf,
      category: "additional",
      backgroundImage: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80"
    },
    {
      title: "Industrial IoT",
      description: "Machine health monitoring, predictive maintenance, and production analytics",
      benefit: "Minimize downtime and maximize productivity",
      icon: Factory,
      category: "additional",
      backgroundImage: "https://images.unsplash.com/photo-1611078489935-0cb6de140edf?w=800&q=80"
    },
    {
      title: "Environmental Monitoring",
      description: "Air quality, noise levels, and pollution tracking",
      benefit: "Ensure compliance and protect public health",
      icon: Eye,
      category: "additional",
      backgroundImage: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80"
    },
    {
      title: "Security Monitoring",
      description: "Surveillance systems, access control, and threat detection",
      benefit: "24/7 security with instant alert notifications",
      icon: Shield,
      category: "additional",
      backgroundImage: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&q=80"
    }
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cardIndex = parseInt(entry.target.dataset.cardIndex);
            setVisibleCards(prev => [...prev, cardIndex]);
          }
        });
      },
      { threshold: 0.2 }
    );

    const cards = document.querySelectorAll(`.${styles.useCaseCard}`);
    cards.forEach(card => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.useCasesSection} ref={sectionRef}>
      <Container className="py-5">
        <Row className="text-center mb-5">
          <Col lg={8} className="mx-auto">
            <h2 className={styles.sectionTitle}>
              IoT Solutions For Every Industry
            </h2>
            <p className={styles.sectionSubtitle}>
              Monitor, analyze, and optimize your operations with powerful IoT dashboards
            </p>
          </Col>
        </Row>

        <Row className="g-4">
          {useCases.map((useCase, index) => {
            const Icon = useCase.icon;
            return (
              <Col key={index} lg={4} md={6} className="mb-4">
                <Card 
                  className={`${styles.useCaseCard} ${
                    visibleCards.includes(index) ? styles.cardVisible : ''
                  }`}
                  data-card-index={index}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div 
                    className={styles.cardBackground}
                    style={{
                      backgroundImage: `url(${useCase.backgroundImage})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  ></div>
                  <Card.Body className="p-4">
                    <div className={styles.iconWrapper}>
                      <Icon size={48} />
                    </div>
                    <h5 className={styles.cardTitle}>{useCase.title}</h5>
                    <p className={styles.cardDescription}>{useCase.description}</p>
                    <div className={styles.benefitBadge}>
                      {useCase.benefit}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      </Container>
    </div>
  );
};

export default UseCasesSection;

