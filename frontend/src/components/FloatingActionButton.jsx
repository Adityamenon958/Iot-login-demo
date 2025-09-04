import React, { useState, useRef, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import styles from './FloatingActionButton.module.css';

const FloatingActionButton = ({ onFiltersClick, onGenerateReportClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tooltipText, setTooltipText] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const [isHoveringButton, setIsHoveringButton] = useState(false);
  const [isHoveringTooltip, setIsHoveringTooltip] = useState(false);
  const buttonRef = useRef(null);
  const tooltipTimeoutRef = useRef(null);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleFiltersClick = () => {
    onFiltersClick();
    setIsExpanded(false);
  };

  const handleGenerateReportClick = () => {
    onGenerateReportClick();
    setIsExpanded(false);
  };

  const handleClose = () => {
    setIsExpanded(false);
  };

  const handleMouseEnter = (text, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 10
    });
    setTooltipText(text);
    setIsHoveringButton(true);
    setShowTooltip(true);
    
    // Clear any existing timeout
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    setIsHoveringButton(false);
    
    // Clear any existing timeout
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    
    // Hide tooltip after a short delay if not hovering over tooltip
    tooltipTimeoutRef.current = setTimeout(() => {
      if (!isHoveringTooltip) {
        setShowTooltip(false);
      }
    }, 150);
  };

  const handleTooltipMouseEnter = () => {
    setIsHoveringTooltip(true);
    
    // Clear any existing timeout
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
  };

  const handleTooltipMouseLeave = () => {
    setIsHoveringTooltip(false);
    setShowTooltip(false);
    
    // Clear any existing timeout
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  // Close tooltip when clicking anywhere
  useEffect(() => {
    const handleClickOutside = () => {
      setShowTooltip(false);
      setIsHoveringButton(false);
      setIsHoveringTooltip(false);
    };

    if (showTooltip) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showTooltip]);

  return (
    <div className={styles.fabContainer}>
      {!isExpanded ? (
        // Closed State - Single FAB button
        <Button
          ref={buttonRef}
          className={styles.fabButton}
          onClick={handleToggle}
          onMouseEnter={(e) => handleMouseEnter("Actions", e)}
          onMouseLeave={handleMouseLeave}
        >
          <span className="bi bi-plus" />
        </Button>
      ) : (
        // Expanded State - Three action buttons
        <div className={styles.fabExpanded}>
          <Button
            className={`${styles.fabItem} ${styles.filterBtn}`}
            onClick={handleFiltersClick}
            onMouseEnter={(e) => handleMouseEnter("Filters", e)}
            onMouseLeave={handleMouseLeave}
          >
            <span className="bi bi-funnel" />
          </Button>
          
          <Button
            className={`${styles.fabItem} ${styles.reportBtn}`}
            onClick={handleGenerateReportClick}
            onMouseEnter={(e) => handleMouseEnter("Generate Report", e)}
            onMouseLeave={handleMouseLeave}
          >
            <span className="bi bi-file-earmark-arrow-down" />
          </Button>
          
          <Button
            className={`${styles.fabItem} ${styles.closeBtn}`}
            onClick={handleClose}
            onMouseEnter={(e) => handleMouseEnter("Close", e)}
            onMouseLeave={handleMouseLeave}
          >
            <span className="bi bi-dash" />
          </Button>
        </div>
      )}
      
      {/* ✅ Custom Tooltip */}
      {showTooltip && (
        <div
          className={styles.customTooltip}
          style={{
            position: 'fixed',
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translateX(-50%)',
            zIndex: 99999
          }}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          {tooltipText}
          <div className={styles.tooltipArrow}></div>
        </div>
      )}
    </div>
  );
};

export default FloatingActionButton;
