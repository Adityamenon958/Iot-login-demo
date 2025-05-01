import React from 'react';
import { Container, Row } from 'react-bootstrap';
import { Outlet } from 'react-router-dom';
import styles from './Dashboard.module.css';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/"); // redirect to login
    }
  }, []);

  return (
    <Container fluid className={styles.dashboard}>
      <Topbar />

      <Row className="flex-grow-1">
        <Sidebar />
        <Outlet /> {/* This changes based on route */}
      </Row>
    </Container>
  );
};

export default Dashboard;
