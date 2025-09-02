import React from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

// ✅ Helper function to format crane list with truncation
function formatCraneList(craneIds, maxDisplay = 5) {
  if (!craneIds || craneIds.length === 0) {
    return 'None';
  }
  
  if (craneIds.length <= maxDisplay) {
    return craneIds.join(', ');
  }
  
  const displayedCranes = craneIds.slice(0, maxDisplay);
  const remainingCount = craneIds.length - maxDisplay;
  
  return `${displayedCranes.join(', ')}, and ${remainingCount} more...`;
}

// ✅ Crane Tooltip Component
export default function CraneTooltip({ craneIds, children, placement = 'top' }) {
  if (!craneIds || craneIds.length === 0) {
    return children;
  }
  
  const tooltipContent = formatCraneList(craneIds);
  
  return (
    <OverlayTrigger
      placement={placement}
      overlay={
        <Tooltip id="crane-tooltip" style={{ 
          backgroundColor: '#000', 
          color: '#fff',
          fontSize: '0.75rem',
          maxWidth: '300px',
          wordWrap: 'break-word'
        }}>
          {tooltipContent}
        </Tooltip>
      }
    >
      {children}
    </OverlayTrigger>
  );
}
