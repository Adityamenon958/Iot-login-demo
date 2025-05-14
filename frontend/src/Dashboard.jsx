import React, { useEffect, useState } from 'react';
import { Container, Row } from 'react-bootstrap';
import { Outlet, useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const Dashboard = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/");
  }, []);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const closeSidebar = () => setSidebarOpen(false);

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