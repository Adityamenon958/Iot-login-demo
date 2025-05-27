// frontend/src/pages/Dashboard.jsx

import React, { useEffect, useState } from 'react';
import { Container, Row } from 'react-bootstrap';
import { Outlet, useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';
import Sidebar from '../Sidebar';
import Topbar from '../Topbar';
import axios from 'axios';

const Dashboard = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        await axios.get('/api/auth/userinfo', { withCredentials: true });
        setAuthChecked(true);
      } catch (err) {
        navigate('/');
      }
    };

    verifyAuth();
  }, [navigate]);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  if (!authChecked) return null; // Optional: Add loader

  return (
    <Container fluid className={styles.dashboard}>
      <Topbar toggleSidebar={toggleSidebar} />
      <Row className="flex-grow-1">
        <Sidebar isOpen={sidebarOpen} closeSidebar={closeSidebar} />
        <Outlet />
      </Row>
    </Container>
  );
};

export default Dashboard;
