import React from 'react';
import { Col, Row, Card } from 'react-bootstrap';
import styles from './MainContent.module.css';
import { Activity, AlertCircle, PauseCircle } from 'lucide-react';

const DashboardHome = () => {
  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main}>
      <div className="p-3">
        <Row className="g-4">
          <Col xs={12} md={4}>
            <Card className={`${styles.deviceCard} text-center`}>
              <Card.Body>
                <i className={`bi bi-hdd-stack-fill text-primary ${styles.deviceIcon}`}></i>
                <Card.Title className={styles.cardTitle}>Active Devices</Card.Title>
                <div className={styles.metricNumber}>0</div>
              </Card.Body>
            </Card>
          </Col>
    
          <Col xs={12} md={4}>
            <Card className={`${styles.deviceCard} text-center`}>
              <Card.Body>
                <i className={`bi bi-hdd text-secondary ${styles.deviceIcon}`}></i>
                <Card.Title className={styles.cardTitle}>Inactive Devices</Card.Title>
                <div className={styles.metricNumber}>0</div>
              </Card.Body>
            </Card>
          </Col>
    
          <Col xs={12} md={4}>
            <Card className={`${styles.deviceCard} text-center`}>
              <Card.Body>
                <i className={`bi bi-exclamation-triangle-fill text-danger ${styles.deviceIcon}`}></i>
                <Card.Title className={styles.cardTitle}>Alarms</Card.Title>
                <div className={styles.metricNumber}>0</div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    </Col>
  );
};

export default DashboardHome;
