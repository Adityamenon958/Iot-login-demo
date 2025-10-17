import React from 'react';
import { Badge } from 'react-bootstrap';

const StatusDisplay = ({ serviceStatus, powerStatus, operationalStatus, priorityStatus }) => {
  // Helper to render a group of statuses
  const renderStatusGroup = (statuses, isLastGroup) => {
    if (!statuses || statuses.length === 0) {
      return null; // Don't render if no statuses for this group
    }
    const uniqueStatuses = [...new Set(statuses.filter(status => status && status.trim() !== '' && status !== 'Unknown'))];
    if (uniqueStatuses.length === 0) {
      return null;
    }

    return (
      <div 
        className="d-flex flex-wrap gap-1"
        style={{
          paddingBottom: isLastGroup ? '0' : '4px',
          marginBottom: isLastGroup ? '0' : '4px',
          borderBottom: isLastGroup ? 'none' : '1px solid #dee2e6'
        }}
      >
        {uniqueStatuses.map((status, index) => (
          <Badge
            key={`${status}-${index}`}
            bg={getStatusColor(status)}
            style={{
              fontSize: '0.7rem',
              padding: '0.25rem 0.5rem'
            }}
          >
            {status}
          </Badge>
        ))}
      </div>
    );
  };

  // Define status colors based on status type
  const getStatusColor = (status) => {
    const lowerStatus = status.toLowerCase();
    
    // Error/Critical statuses - Red
    if (lowerStatus.includes('oeps') || lowerStatus.includes('overload') || 
        lowerStatus.includes('earthquake') || lowerStatus.includes('fire return') ||
        lowerStatus.includes('comm fault') || lowerStatus.includes('comprehensive fault')) {
      return 'danger';
    }
    
    // Maintenance statuses - Warning/Yellow
    if (lowerStatus.includes('maintenance') || lowerStatus.includes('inspection')) {
      return 'warning';
    }
    
    // Normal/Service statuses - Success/Green
    if (lowerStatus.includes('in service') || lowerStatus.includes('automatic') ||
        lowerStatus.includes('normal power') || lowerStatus.includes('safety circuit') ||
        lowerStatus.includes('up') || lowerStatus.includes('down')) {
      return 'success';
    }
    
    // Communication statuses - Info/Blue
    if (lowerStatus.includes('comm normal')) {
      return 'info';
    }
    
    // Door/Operational statuses - Light/Primary
    if (lowerStatus.includes('door open') || lowerStatus.includes('attendant') ||
        lowerStatus.includes('independent') || lowerStatus.includes('fire exclusive')) {
      return 'primary';
    }
    
    // Default - Secondary/Gray
    return 'secondary';
  };

  // Determine which groups have data
  const hasOperational = operationalStatus && operationalStatus.length > 0;
  const hasService = serviceStatus && serviceStatus.length > 0;
  const hasPower = powerStatus && powerStatus.length > 0;

  const hasAnyStatus = hasOperational || hasService || hasPower;

  if (!hasAnyStatus) {
    return <span className="text-muted">No Status</span>;
  }

  // Create array of groups that have data
  const groupsToRender = [
    { key: 'operational', statuses: operationalStatus, hasData: hasOperational },
    { key: 'service', statuses: serviceStatus, hasData: hasService },
    { key: 'power', statuses: powerStatus, hasData: hasPower }
  ].filter(group => group.hasData);

  return (
    <div
      className="d-flex flex-column"
      style={{
        border: '1px solid #e9ecef',
        borderRadius: '6px',
        padding: '6px 8px',
        backgroundColor: '#f8f9fa',
        minHeight: '32px'
      }}
    >
      {groupsToRender.map((group, index) => (
        <React.Fragment key={group.key}>
          {renderStatusGroup(group.statuses, index === groupsToRender.length - 1)}
        </React.Fragment>
      ))}
    </div>
  );
};

export default StatusDisplay;
