import React, { useRef, useEffect, useState } from 'react';
import { Col, Button, Nav, Spinner } from 'react-bootstrap';
import { LayoutDashboard, FileText, Settings, LogOut, X, Activity } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { googleLogout } from '@react-oauth/google';
import styles from './Sidebar.module.css';
import { UserPlus } from 'lucide-react';
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { PlusSquare } from 'lucide-react';
import { MdOutlineSubscriptions } from "react-icons/md";
import { Truck } from 'lucide-react';
import { PiElevatorDuotone } from "react-icons/pi";
import Dlogo from './assets/DashboardLogo.png';

import axios from 'axios';

export default function Sidebar({ isOpen, closeSidebar }) {
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useRef(null);

  const [role, setRole] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('inactive');
  const [companyAccess, setCompanyAccess] = useState({});
  const [accessLoading, setAccessLoading] = useState(true);

  // ✅ Securely fetch role & companyName from backend cookies
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await axios.get('/api/auth/userinfo', { withCredentials: true });
        setRole(res.data.role);
        setCompanyName(res.data.companyName);
        
        // ✅ Fetch company access permissions (only for non-superadmin users)
        if (res.data.role !== 'superadmin') {
          await fetchCompanyAccess(res.data.companyName);
        } else {
          setAccessLoading(false);
        }
      } catch (err) {
        console.error("❌ Failed to fetch user info from cookies:", err.message);
        setAccessLoading(false);
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

    const fetchCompanyAccess = async (company) => {
      try {
        // ✅ Use individual access check for each dashboard
        const accessChecks = await Promise.all([
          axios.get('/api/check-dashboard-access/dashboard', { withCredentials: true }),
          axios.get('/api/check-dashboard-access/craneOverview', { withCredentials: true }),
          axios.get('/api/check-dashboard-access/elevatorOverview', { withCredentials: true }),
          axios.get('/api/check-dashboard-access/reports', { withCredentials: true }),
          axios.get('/api/check-dashboard-access/addUsers', { withCredentials: true }),
          axios.get('/api/check-dashboard-access/addDevices', { withCredentials: true }),
          axios.get('/api/check-dashboard-access/subscription', { withCredentials: true }),
          axios.get('/api/check-dashboard-access/settings', { withCredentials: true })
        ]);

        const access = {
          home: true, // Always accessible
          dashboard: accessChecks[0].data.hasAccess,
          craneOverview: accessChecks[1].data.hasAccess,
          elevatorOverview: accessChecks[2].data.hasAccess,
          reports: accessChecks[3].data.hasAccess,
          addUsers: accessChecks[4].data.hasAccess,
          addDevices: accessChecks[5].data.hasAccess,
          subscription: accessChecks[6].data.hasAccess,
          settings: accessChecks[7].data.hasAccess
        };

        setCompanyAccess(access);
        console.log('✅ Company access loaded for:', company, access);
      } catch (err) {
        console.error("❌ Failed to fetch company access:", err.message);
        // Set default access if API fails
        setCompanyAccess({
          home: true,
          dashboard: true,
          craneOverview: false,
          elevatorOverview: false,
          craneDashboard: false,
          reports: true,
          addUsers: true,
          addDevices: true,
          subscription: true,
          settings: true
        });
      } finally {
        setAccessLoading(false);
      }
    };

    fetchUserInfo();
    fetchSubscriptionStatus();
  }, []);

  const handleLogout = async () => {
    try {
      await axios.post('/api/logout', {}, { withCredentials: true });
      googleLogout();
      navigate('/');
    } catch (err) {
      console.error("Logout failed:", err.message);
      navigate('/');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        closeSidebar();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeSidebar]);

  if (accessLoading) {
    return (
      <div className={`${styles.sidebarWrapper} ${isOpen ? styles.open : ''}`}>
        <Col xs={12} md={3} lg={2} xl={2} className={`${styles.sidebar} p-0 pt-4`}>
          <div className="d-flex justify-content-center align-items-center" style={{ height: '50vh' }}>
            <Spinner animation="border" variant="primary" />
          </div>
        </Col>
      </div>
    );
  }

  return (
    <div className={`${styles.sidebarWrapper} ${isOpen ? styles.open : ''}`} ref={sidebarRef}>
      <Col xs={12} md={3} lg={2} xl={2} className={`${styles.sidebar} p-0 pt-4`}>
        {/* ✅ Company Branding Section */}
        <div className={`${styles.sidebarBranding} px-3 mb-4`}>
          <div className="d-flex align-items-center">
            <img src={Dlogo} className={`${styles.sidebarLogo} me-2`} alt="Logo" />
            <div className="d-flex flex-column">
              <h5 className={`${styles.sidebarCompanyName} mb-0`}>
                {companyName || 'Company'}
              </h5>
              <small className={`${styles.sidebarSubtitle}`}>
                Internet Of Things
              </small>
            </div>
          </div>
        </div>

        <Nav className="flex-column align-items-start px-3">
          {/* ✅ Home - Always accessible */}
          <Button className={`${styles.iconButton} ${location.pathname === '/dashboard' ? styles.active : ''}`} onClick={() => navigate('/dashboard')}>
            <LayoutDashboard size={20} className="me-2" />
            Home
          </Button>

          {/* ✅ Dashboard - Check access for non-superadmin */}
          {(role === 'superadmin' || companyAccess.dashboard) && (
          <Button className={`${styles.iconButton} ${location.pathname === '/dashboard/device' ? styles.active : ''}`} onClick={() => navigate('/dashboard/device')}>
            <FileText size={20} className={`${styles.navText} me-2`} />
              Dashboard
          </Button>
          )}

          {/* ✅ Crane Overview - Check access for non-superadmin */}
          {(role === 'superadmin' || companyAccess.craneOverview) && (
          <Button className={`${styles.iconButton} ${location.pathname === '/dashboard/crane-overview' ? styles.active : ''}`} onClick={() => navigate('/dashboard/crane-overview')}>
             <Truck size={30} className={`${styles.navText} me-2`} />
              Crane Overview
          </Button>
          )}

          {/* ✅ Elevator Overview - Check access for non-superadmin */}
          {(role === 'superadmin' || companyAccess.elevatorOverview) && (
          <Button className={`${styles.iconButton} ${location.pathname === '/dashboard/elevator-overview' ? styles.active : ''}`} onClick={() => navigate('/dashboard/elevator-overview')}>
    <PiElevatorDuotone size={30} className={`${styles.navText} me-2`} />
    Elevator Overview
</Button>
          )}

          {/* ✅ Reports - Check access for non-superadmin */}
          {(role === 'superadmin' || companyAccess.reports) && (
          <Button className={`${styles.iconButton} ${location.pathname === '/dashboard/reports' ? styles.active : ''}`} onClick={() => navigate('/dashboard/reports')}>
            <FileText size={20} className={`${styles.navText} me-2`} />
            Report
          </Button>
          )}

          {/* ✅ Manage Company - Superadmin only */}
          {role === "superadmin" && (
            <Button className={`${styles.iconButton2} ${location.pathname === '/dashboard/managecompany' ? styles.active2 : ''}`} onClick={() => navigate('/dashboard/managecompany')}>
              <HiOutlineOfficeBuilding size={25} className={`${styles.navText} me-2`} />
              <div className={`${styles.Text} text-nowrap`}>Manage Company</div>
            </Button>
          )}

          {/* ✅ Simulator - Superadmin only in production */}
          {role === "superadmin" && process.env.NODE_ENV === 'production' && (
            <Button className={`${styles.iconButton} ${location.pathname === '/dashboard/simulator' ? styles.active : ''}`} onClick={() => navigate('/dashboard/simulator')}>
              <Activity size={20} className="me-2" />
              Simulator
            </Button>
          )}

          {/* ✅ Add Users - Check access for non-superadmin OR allow superadmin */}
          {((role === "admin" && companyAccess.addUsers) || role === "superadmin") && (
            <Button className={`${styles.iconButton} ${location.pathname === '/dashboard/adduser' ? styles.active : ''}`} onClick={() => navigate('/dashboard/adduser')} disabled={subscriptionStatus !== 'active' && role !== 'superadmin'}>
              <UserPlus size={20} className={`${styles.navText} me-2`} />
              Manage Users
            </Button>
          )}

          {/* ✅ Add Device - Check access for non-superadmin */}
          {((role === "admin" && companyAccess.addDevices) || role === "superadmin") && (
            <Button className={`${styles.iconButton} ${location.pathname === '/dashboard/adddevice' ? styles.active : ''}`} onClick={() => navigate('/dashboard/adddevice')} disabled={subscriptionStatus !== 'active' && role !== 'superadmin'}>
              <PlusSquare size={20} className="me-2" />
              Manage Device
            </Button>
          )}

          {/* ✅ Subscription - Check access for non-superadmin */}
          {(role === 'superadmin' || companyAccess.subscription) && (
          <Button className={`${styles.iconButton} ${location.pathname === '/dashboard/subscription' ? styles.active : ''}`} onClick={() => navigate('/dashboard/subscription')}>
            <MdOutlineSubscriptions size={20} className="me-2" />
            Subscription
          </Button>
          )}

          {/* ✅ Settings - Check access for non-superadmin */}
          {(role === 'superadmin' || companyAccess.settings) && (
          <Button className={`${styles.iconButton} ${location.pathname === '/dashboard/settings' ? styles.active : ''}`} onClick={() => navigate('/dashboard/settings')}>
            <Settings size={20} className="me-2" />
            Settings
          </Button>
          )}

          <Button className={styles.iconButton} onClick={handleLogout}>
            <LogOut size={20} className="me-2" />
            Logout
          </Button>
        </Nav>
      </Col>
    </div>
  );
}
