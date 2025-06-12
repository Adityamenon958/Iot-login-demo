import React, { useRef, useEffect, useState } from 'react';
import { Col, Button, Nav } from 'react-bootstrap';
import { LayoutDashboard, FileText, Settings, LogOut, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { googleLogout } from '@react-oauth/google';
import styles from './Sidebar.module.css';
import { UserPlus } from 'lucide-react';
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { PlusSquare } from 'lucide-react';
import { MdOutlineSubscriptions } from "react-icons/md";

import axios from 'axios';

export default function Sidebar({ isOpen, closeSidebar }) {
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef(null);

  const [role, setRole] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('inactive');

  // ✅ Securely fetch role & companyName from backend cookies
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await axios.get('/api/auth/userinfo', { withCredentials: true });
        setRole(res.data.role);
        setCompanyName(res.data.companyName);
      } catch (err) {
        console.error("❌ Failed to fetch user info from cookies:", err.message);
      }
    };

    const fetchSubscriptionStatus = async () => {
      try {
        const res = await axios.get('/api/subscription/status', { withCredentials: true });
        setSubscriptionStatus(res.data.active ? 'active' : 'inactive');
      } catch (err) {
        console.error("❌ Failed to fetch subscription status:", err.message);
        setSubscriptionStatus('inactive');
      }
    };

    fetchUserInfo();
    fetchSubscriptionStatus();
  }, []);

  const handleLogout = async () => {
    try {
      await axios.post('/api/logout', {}, { withCredentials: true }); // ✅ Clears cookie
      navigate('/');
    } catch (err) {
      console.error("Logout error:", err.message);
      alert("Logout failed");
    }
  };

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
    <div className={`${styles.sidebarWrapper} ${isOpen ? styles.open : ''}`} ref={sidebarRef}>
      <Col xs={12} md={3} lg={2} xl={2} className={`${styles.sidebar} p-0 pt-4`}>
        <Nav className="flex-column align-items-start px-3">
          <Button className={`${styles.iconButton} ${location.pathname === '/dashboard' ? styles.active : ''}`} onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={20} className="me-2" />
            Dashboard
          </Button>

          <Button className={`${styles.iconButton} ${location.pathname === '/dashboard/device' ? styles.active : ''}`} onClick={() => navigate('/dashboard/device')}>
            <FileText size={20} className={`${styles.navText} me-2`} />
            Fuel Monitoring
          </Button>

          <Button className={`${styles.iconButton} ${location.pathname === '/dashboard/reports' ? styles.active : ''}`} onClick={() => navigate('/dashboard/reports')}>
            <FileText size={20} className={`${styles.navText} me-2`} />
            Report
          </Button>

          {role === "superadmin" && (
            <Button className={`${styles.iconButton2} ${location.pathname === '/dashboard/managecompany' ? styles.active2 : ''}`} onClick={() => navigate('/dashboard/managecompany')}>
              <HiOutlineOfficeBuilding size={25} className={`${styles.navText} me-2`} />
              <div className={`${styles.Text} text-nowrap`}>Manage Company</div>
            </Button>
          )}

          {role === "admin" && (
            <Button className={`${styles.iconButton} ${location.pathname === '/dashboard/adduser' ? styles.active : ''}`} onClick={() => navigate('/dashboard/adduser')} disabled={subscriptionStatus !== 'active'}>
              <UserPlus size={20} className={`${styles.navText} me-2`} />
              Add Users
            </Button>
          )}

          {(role === "admin" || (role === "superadmin" )) && (
            <Button className={`${styles.iconButton} ${location.pathname === '/dashboard/adddevice' ? styles.active : ''}`} onClick={() => navigate('/dashboard/adddevice')} disabled={subscriptionStatus !== 'active'}>
              <PlusSquare size={20} className="me-2" />
              Add Device
            </Button>
          )}

          <Button className={`${styles.iconButton} ${location.pathname === '/dashboard/subscription' ? styles.active : ''}`} onClick={() => navigate('/dashboard/subscription')}>
            <MdOutlineSubscriptions size={20} className="me-2" />
            Subscription
          </Button>

          <Button className={`${styles.iconButton} ${location.pathname === '/dashboard/settings' ? styles.active : ''}`} onClick={() => navigate('/dashboard/settings')}>
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
