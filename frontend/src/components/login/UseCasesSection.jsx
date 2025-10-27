import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import styles from './UseCasesSection.module.css';

const UseCasesSection = () => {
  return (
    <div className={styles.useCasesSection}>
      <Container className="py-5">
        <Row>
          <Col lg={12}>
            <div className={styles.placeholder}>
              <h2>Use Cases Section</h2>
              <p>Content coming soon...</p>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default UseCasesSection;

