import React from 'react';
import { Badge } from 'react-bootstrap';
import { PiClock } from 'react-icons/pi';

// ✅ Component to display last updated timestamp
export const LastUpdatedTimestamp = ({ lastUpdated, className = '' }) => {
  if (!lastUpdated) return null;

  const formatTime = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ago`;
    }
  };

  return (
    <Badge 
      bg="light" 
      text="dark" 
      className={`d-flex align-items-center gap-1 ${className}`}
      style={{ 
        fontSize: '0.7rem', 
        padding: '0.25rem 0.5rem',
        borderRadius: '12px',
        border: '1px solid #dee2e6'
      }}
    >
      <PiClock size={12} />
      <span>Updated {formatTime(lastUpdated)}</span>
    </Badge>
  );
};

// ✅ Component for multiple timestamps
export const MultipleTimestamps = ({ timestamps = {} }) => {
  const formatTime = (date) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ago`;
    }
  };

  return (
    <div className="d-flex flex-wrap gap-2">
      {Object.entries(timestamps).map(([key, timestamp]) => (
        <Badge 
          key={key}
          bg="light" 
          text="dark" 
          className="d-flex align-items-center gap-1"
          style={{ 
            fontSize: '0.65rem', 
            padding: '0.2rem 0.4rem',
            borderRadius: '10px',
            border: '1px solid #dee2e6'
          }}
        >
          <PiClock size={10} />
          <span>{key}: {formatTime(timestamp)}</span>
        </Badge>
      ))}
    </div>
  );
}; 