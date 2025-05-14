import React, { useRef, useEffect } from 'react';
import { Col, Button, Nav } from 'react-bootstrap';
import { LayoutDashboard, FileText, Settings, LogOut, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { googleLogout } from '@react-oauth/google';
import styles from './Sidebar.module.css';

export default function Sidebar({ isOpen, closeSidebar  }) {
  const navigate = useNavigate();
  const sidebarRef = useRef(null);

  const handleLogout = () => {
    googleLogout();
    localStorage.removeItem("token");
    navigate("/");
  };

   // Close on outside click
   useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target) &&
        isOpen
      ) {
        closeSidebar();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, closeSidebar]);


  return (
    <div className={`${styles.sidebarWrapper} ${isOpen ? styles.open : ''} `} ref={sidebarRef}>
      <Col xs={12} md={3} lg={2} xl={2} className={`${styles.sidebar} p-0 pt-4`}>
        <Nav className="flex-column align-items-start px-3">
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
      </Col>
    </div>
  );
}
