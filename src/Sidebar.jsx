import React from 'react';
import { Col, Button, Nav } from 'react-bootstrap';
import { LayoutDashboard, FileText, Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { googleLogout } from '@react-oauth/google';
import styles from './Sidebar.module.css';

export default function Sidebar() {

  const navigate = useNavigate();

  const handleLogout = () => {
    googleLogout(); // optional, logs out of Google session too
    localStorage.removeItem("token"); // clear token
    navigate("/"); // redirect to login
  };

  return (
    <Col xs={12} md={3} lg={2} xl={2} className={`${styles.sidebar} p-0 pt-4`}>
      <div className={`${styles.vertical_line} ms-3`}></div>

      <div className={styles.sidebar}>
        <Nav className="flex-column align-items-start">
          <Button className={styles.iconButton} onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={20} className="me-2" />
            Dashboard
          </Button>

          <Button className={styles.iconButton} onClick={() => navigate('/dashboard/reports')}>
            <FileText size={20} className="me-2" />
            Report
          </Button>

          <Button className={styles.iconButton} onClick={() => navigate('/dashboard/settings')}>
            <Settings size={20} className="me-2" />
            Settings
          </Button>

          <Button className={styles.iconButton} onClick={handleLogout}>
            <LogOut size={20} className="me-2" />
            Logout
          </Button>
        </Nav>
      </div>
    </Col>
  );
}
