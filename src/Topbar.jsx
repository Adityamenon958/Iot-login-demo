import React from 'react'
import { Container, Row, Col } from 'react-bootstrap';
import styles from './Toopbar.module.css';
import Dlogo from "../src/assets/DashboardLogo.png";


export default function Topbar() {
 return (
    <Row className={styles.topbar}>
      <img src={Dlogo} className={`${styles.Dlogo} ms-2 mt-1`}/>
        <Col>
        
          <h4 className={`p-3 ps-0 h-100 d-flex align-items-center ${styles.DlogoText}`}>Internet Of Things</h4>
        </Col>
      </Row>
  )
}
