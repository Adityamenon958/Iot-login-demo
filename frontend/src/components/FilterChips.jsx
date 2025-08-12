import React from 'react';

export default function FilterChips({ filters, onClick }) {
  const { cranes = [], start, end } = filters || {};

  const cranesLabel = cranes.length === 0 ? 'All Cranes' : `${cranes.length} crane(s)`;
  const dateLabel = start && end ? `${start} – ${end}` : 'Date range';

  const chipStyle = {
    fontSize: '0.7rem',
    padding: '6px 10px',
    borderRadius: '999px',
    background: '#f1f3f5',
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    lineHeight: 1,
    whiteSpace: 'nowrap'
  };

  return (
    <div className="d-flex align-items-center gap-2" onClick={onClick} style={{ cursor: 'pointer' }}>
      <span style={chipStyle}>🏗️ {cranesLabel}</span>
      <span style={chipStyle}>📅 {dateLabel}</span>
    </div>
  );
} 