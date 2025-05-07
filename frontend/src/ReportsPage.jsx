import React from 'react';
import { Container, Row, Col, Card, Table } from 'react-bootstrap';
import styles from './MainContent.module.css';

const ReportsPage = () => {

  const mostDownloadedIssues = [
    { issue: 'Issue A - Grade 6', downloads: 120 },
    { issue: 'Issue F - Grade 5', downloads: 90 },
    { issue: 'Issue C - Grade 7', downloads: 75 },
  ];

  const userEngagement = [
    { user: 'John Doe', sessions: 5, downloads: 12 },
    { user: 'Jane Smith', sessions: 3, downloads: 7 },
    { user: 'Ravi Kumar', sessions: 6, downloads: 15 },
  ];

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main}>
      <Row className="mb-4">
        <Col>
          <h4 className="mt-3">Download Statistics</h4>
        </Col>
      </Row>

      {/* Cards Section */}
      <Row className="g-3 mb-4">
        <Col md={4}>
          <Card className={styles.statCard}>
            <Card.Body>
              <Card.Title>Worksheets Downloaded</Card.Title>
              <h2>132</h2>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className={styles.statCard}>
            <Card.Body>
              <Card.Title>Flashcards Downloaded</Card.Title>
              <h2>89</h2>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className={styles.statCard}>
            <Card.Body>
              <Card.Title>Total Downloads</Card.Title>
              <h2>221</h2>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Most Downloaded Issues */}
      <Row className="mb-4">
        <Col>
          <h5>Most Downloaded Issues</h5>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Downloads</th>
              </tr>
            </thead>
            <tbody>
              {mostDownloadedIssues.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.issue}</td>
                  <td>{item.downloads}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Col>
      </Row>

      {/* User Engagement */}
      <Row>
        <Col>
          <h5>User Engagement</h5>
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>User</th>
                <th>Sessions</th>
                <th>Downloads</th>
              </tr>
            </thead>
            <tbody>
              {userEngagement.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.user}</td>
                  <td>{item.sessions}</td>
                  <td>{item.downloads}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Col>
      </Row>
    </Col>
  );
};

export default ReportsPage;
