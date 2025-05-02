import React from 'react';
import { Col, Row, Card, Table, Button, Form } from 'react-bootstrap';
import styles from './MainContent.module.css';
import  "./MainContent.css";
import { Activity, AlertCircle, PauseCircle } from 'lucide-react';

const sampleDevices = [
  {
    id: 'D001',
    name: 'Sensor Alpha',
    location: 'Mumbai',
    subscription: 'Active'
  },
  {
    id: 'D002',
    name: 'Sensor Beta',
    location: 'Delhi',
    subscription: 'Inactive'
  },
  {
    id: 'D003',
    name: 'Sensor Gamma',
    location: 'Bangalore',
    subscription: 'Active'
  }
];

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
      <div className="mt-4">
  <h5>Device List</h5>
  <Table striped bordered hover responsive>
    <thead>
      <tr>
        <th>
          <Form.Check type="checkbox" />
        </th>
        <th>Device ID</th>
        <th>Device Name</th>
        <th>Location</th>
        <th>View Logs</th>
        <th>Subscription</th>
      </tr>
    </thead>
    <tbody>
      {sampleDevices.map((device, index) => (
        <tr key={index}>
          <td>
            <Form.Check type="checkbox" />
          </td>
          <td>{device.id}</td>
          <td>{device.name}</td>
          <td>{device.location}</td>
          <td>
            <Button variant="outline-primary" size="sm">
              View Logs
            </Button>
          </td>
          <td>{device.subscription}</td>
        </tr>
      ))}
    </tbody>
  </Table>
</div>

    </Col>
  );
};

export default DashboardHome;
