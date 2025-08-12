import React, { useEffect, useState } from 'react';
import { Button, Dropdown, Form } from 'react-bootstrap';

// ✅ Simple filter bar UI (no data wiring yet)
export default function FilterBar({ cranes = [], value, onChange, onApply, onReset }) {
  const [selectedCranes, setSelectedCranes] = useState(value?.cranes || []);
  const [start, setStart] = useState(value?.start || '');
  const [end, setEnd] = useState(value?.end || '');

  useEffect(() => {
    onChange?.({ cranes: selectedCranes, start, end });
  }, [selectedCranes, start, end]);

  const toggleCrane = (id) => {
    setSelectedCranes((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const allSelected = selectedCranes.length === cranes.length;
  const label = allSelected || selectedCranes.length === 0
    ? 'All Cranes'
    : `${selectedCranes.length} selected`;

  return (
    <div className="d-flex align-items-center gap-2">
      {/* Cranes multi-select */}
      <Dropdown>
        <Dropdown.Toggle size="sm" variant="outline-secondary">
          🏗️ {label}
        </Dropdown.Toggle>
        <Dropdown.Menu style={{ maxHeight: 300, overflowY: 'auto' }}>
          <Dropdown.Item onClick={() => setSelectedCranes([])}>Select All</Dropdown.Item>
          <Dropdown.Divider />
          {cranes.map((id) => (
            <Form.Check
              key={id}
              type="checkbox"
              id={`crane-${id}`}
              className="px-3 py-1"
              label={id}
              checked={selectedCranes.includes(id)}
              onChange={() => toggleCrane(id)}
            />
          ))}
        </Dropdown.Menu>
      </Dropdown>

      {/* Date range */}
      <Form.Control
        type="date"
        size="sm"
        value={start}
        onChange={(e) => setStart(e.target.value)}
      />
      <span style={{ fontSize: '0.8rem' }}>to</span>
      <Form.Control
        type="date"
        size="sm"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
      />

      {/* Actions */}
      <Button size="sm" variant="primary" onClick={() => onApply?.({ cranes: selectedCranes, start, end })}>
        Apply
      </Button>
      <Button size="sm" variant="outline-secondary" onClick={() => { setSelectedCranes([]); setStart(''); setEnd(''); onReset?.(); }}>
        Reset
      </Button>
    </div>
  );
} 