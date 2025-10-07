import React from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

// ✅ Helper function to format elevator list with company and location
function formatElevatorList(elevators, maxDisplay = 8) {
  if (!elevators || elevators.length === 0) {
    return 'None';
  }
  
  const lines = elevators.slice(0, maxDisplay).map(e => 
    `${e.id} - ${e.company} - ${e.location}`
  );
  
  if (elevators.length > maxDisplay) {
    const remainingCount = elevators.length - maxDisplay;
    lines.push(`...and ${remainingCount} more`);
  }
  
  return lines.join('\n');
}

// ✅ Elevator Tooltip Component
export default function ElevatorTooltip({ elevators, title, children, placement = 'top' }) {
  if (!elevators || elevators.length === 0) {
    return children;
  }
  
  const tooltipContent = (
    <div style={{ textAlign: 'left', whiteSpace: 'pre-line' }}>
      <strong>{title} ({elevators.length}):</strong>
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.3)', margin: '4px 0' }}></div>
      {formatElevatorList(elevators)}
    </div>
  );
  
  return (
    <OverlayTrigger
      placement={placement}
      overlay={
        <Tooltip id={`elevator-tooltip-${title}`} style={{ 
          backgroundColor: '#000', 
          color: '#fff',
          fontSize: '0.75rem',
          maxWidth: '350px',
          padding: '8px 12px',
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

