import React from 'react';
import { Row, Col, Button } from 'react-bootstrap';
import styles from './Toopbar.module.css';
import Dlogo from '../src/assets/DashboardLogo.png';
import { Menu } from 'lucide-react';

export default function Topbar({ toggleSidebar }) {
  return (
    <Row className={`${styles.topbar} align-items-center`}>
      <Col xs="auto" className="d-flex align-items-center">
        <Button
          className={` me-2 ${styles.burgerButton}`}
          onClick={toggleSidebar}
        >
          <Menu />
        </Button>
        <img src={Dlogo} className={`${styles.Dlogo}`} alt="Logo" />
      </Col>
      <Col>
        <h4 className={`p-3 ps-0 h-100 d-flex align-items-center ${styles.DlogoText}`}>
          Internet Of Things
        </h4>
      </Col>
    </Row>
  );
}
