import React, { useState, useRef, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import styles from './FloatingActionButton.module.css';

const FloatingActionButton = ({ onFiltersClick, onGenerateReportClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [tooltipText, setTooltipText] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const buttonRef = useRef(null);

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
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

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
        >
          {tooltipText}
          <div className={styles.tooltipArrow}></div>
        </div>
      )}
    </div>
  );
};

export default FloatingActionButton;
