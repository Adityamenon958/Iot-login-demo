import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Button, Modal, Image } from 'react-bootstrap';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import styles from './Toopbar.module.css';
import Dlogo from '../src/assets/DashboardLogo.png';
import { Menu, User, LogOut } from 'lucide-react';
import { generateCompanyInitials } from './lib/userUtils';

export default function Topbar({ toggleSidebar }) {
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  
  // ✅ Tooltip states
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipText, setTooltipText] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const profileRef = useRef(null);

  // ✅ Fetch user info when component mounts
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await axios.get('/api/auth/userinfo', { withCredentials: true });
        setUserInfo(res.data);
      } catch (err) {
        console.error("Failed to fetch user info:", err);
      }
    };

    fetchUserInfo();
  }, []);

  // ✅ Handle logout
  const handleLogout = async () => {
    try {
      await axios.post('/api/logout', {}, { withCredentials: true });
      setShowProfileModal(false);
      navigate('/');
    } catch (err) {
      console.error("Logout failed:", err.message);
      navigate('/');
    }
  };

  // ✅ Handle profile navigation
  const handleProfileClick = () => {
    setShowProfileModal(false);
    navigate('/dashboard/settings');
  };

  // ✅ Tooltip handlers
  const handleMouseEnter = (text, ref) => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom + 10
      });
      setTooltipText(text);
      setShowTooltip(true);
    }
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  // ✅ Handle outside click to close modal
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileModal) {
        const modal = document.querySelector(`.${styles.profileModal}`);
        const profilePicture = document.querySelector(`.${styles.profilePicture}`);
        
        if (modal && !modal.contains(event.target) && profilePicture && !profilePicture.contains(event.target)) {
          setShowProfileModal(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileModal]);

  return (
    <>
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
      
      {/* ✅ Profile Picture Section */}
      <Col xs="auto" className="d-flex align-items-center pe-3">
        <div 
          ref={profileRef}
          className={styles.profilePicture}
          onClick={() => setShowProfileModal(true)}
          onMouseEnter={() => handleMouseEnter("Click to open profile menu", profileRef)}
          onMouseLeave={handleMouseLeave}
        >
          <div className={styles.textAvatar}>
            {generateCompanyInitials(userInfo?.companyName)}
          </div>
        </div>
      </Col>
    </Row>

    {/* ✅ Custom Tooltip */}
    {showTooltip && (
      <div
        className={styles.customTooltip}
        style={{
          left: tooltipPosition.x,
          top: tooltipPosition.y,
          transform: 'translateX(-50%)'
        }}
      >
        {tooltipText}
        <div className={styles.tooltipArrow}></div>
      </div>
    )}

    {/* ✅ Profile Dropdown Modal */}
    <Modal
      show={showProfileModal}
      onHide={() => setShowProfileModal(false)}
      className={styles.profileModal}
      backdrop={false}
      keyboard={true}
    >
      <Modal.Body className={styles.profileModalBody}>
        <div className={styles.profileHeader}>
          <div className={styles.profileImageContainer}>
            <div className={styles.textAvatarLarge}>
              {generateCompanyInitials(userInfo?.companyName)}
            </div>
          </div>
          <div className={styles.profileInfo}>
            <h6 className={styles.userName}>{userInfo?.name || 'User'}</h6>
            <p className={styles.userEmail}>{userInfo?.email || 'user@example.com'}</p>
          </div>
        </div>
        
        <div className={styles.profileActions}>
          <Button 
            variant="link" 
            className={styles.profileAction}
            onClick={handleProfileClick}
          >
            <User size={16} className="me-2" />
            Your Profile
          </Button>
          
          <Button 
            variant="link" 
            className={styles.profileAction}
            onClick={handleLogout}
          >
            <LogOut size={16} className="me-2" />
            Log out
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  </>
  );
}
