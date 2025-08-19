import React, { useEffect, useMemo, useState, forwardRef, useImperativeHandle } from 'react';
import { Button, Dropdown, Form, OverlayTrigger, Popover } from 'react-bootstrap';
import { FiFilter } from 'react-icons/fi';

const FiltersButton = forwardRef(({ cranes = [], initial, onApply, onReset }, ref) => {
  const [selectedCranes, setSelectedCranes] = useState(initial?.cranes || []);
  const [start, setStart] = useState(initial?.start || '');
  const [end, setEnd] = useState(initial?.end || '');
  const [show, setShow] = useState(false);

  // ✅ Expose methods to parent component
  useImperativeHandle(ref, () => ({
    show: () => setShow(true),
    hide: () => setShow(false)
  }));

  // ✅ Local date formatter to avoid UTC shift
  const toLocalYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    setSelectedCranes(initial?.cranes || []);
    setStart(initial?.start || '');
    setEnd(initial?.end || '');
  }, [initial]);

  const toggleCrane = (id) => {
    setSelectedCranes((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  };

  const presets = useMemo(() => ([
    { label: 'Today', get: () => { const d = new Date(); const iso = toLocalYMD(d); return { start: iso, end: iso }; } },
    { label: 'Last 7 days', get: () => { const e = new Date(); const s = new Date(Date.now() - 6*24*3600*1000); return { start: toLocalYMD(s), end: toLocalYMD(e) }; } },
    // ✅ This month as Month-To-Date (MTD): first day to today (using local dates)
    { label: 'This month', get: () => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth(), 1); const e = d; return { start: toLocalYMD(s), end: toLocalYMD(e) }; } },
  ]), []);

  const popover = (
    <Popover id="filters-popover">
      <Popover.Header as="h3" className="py-2">Filters</Popover.Header>
      <Popover.Body>
        {/* Presets */}
        <div className="d-flex gap-1 mb-2" style={{ flexWrap: 'wrap' }}>
          {presets.map(p => (
            <Button key={p.label} size="sm" variant="light" onClick={() => { const r = p.get(); setStart(r.start); setEnd(r.end); }}>
              {p.label}
            </Button>
          ))}
        </div>

        {/* Cranes */}
        <div className="mb-2">
          <div className="mb-1" style={{ fontSize: '0.8rem' }}>Cranes</div>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
            <div className="d-flex gap-2 mb-2">
              <Button size="sm" variant="outline-secondary" onClick={() => setSelectedCranes(cranes)}>Select All</Button>
              <Button size="sm" variant="outline-secondary" onClick={() => setSelectedCranes([])}>Clear All</Button>
            </div>
            {cranes.map(id => (
              <Form.Check key={id} type="checkbox" id={`flt-${id}`} label={id} checked={selectedCranes.includes(id)} onChange={() => toggleCrane(id)} className="mb-1" />
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="mb-2">
          <div className="mb-1" style={{ fontSize: '0.8rem' }}>Date range</div>
          <div className="d-flex align-items-center gap-2">
            <Form.Control type="date" size="sm" value={start} onChange={(e) => setStart(e.target.value)} />
            <span style={{ fontSize: '0.8rem' }}>to</span>
            <Form.Control type="date" size="sm" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        {/* Actions */}
        <div className="d-flex justify-content-end gap-2 mt-3">
          <Button size="sm" variant="light" onClick={() => { setSelectedCranes([]); setStart(''); setEnd(''); onReset?.(); }}>Reset</Button>
          <Button size="sm" onClick={() => { onApply?.({ cranes: selectedCranes, start, end }); setShow(false); }}>Apply</Button>
        </div>
      </Popover.Body>
    </Popover>
  );

  return (
    <OverlayTrigger 
      trigger="click" 
      placement="bottom-end" 
      rootClose 
      overlay={popover}
      show={show}
      onToggle={(nextShow) => setShow(nextShow)}
      popperConfig={{
        modifiers: [
          {
            name: 'offset',
            options: {
              offset: [0, 8],
            },
          },
        ],
      }}
    >
      <Button size="sm" variant="outline-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', borderRadius: 8 }}>
        <FiFilter size={16} />
        <span>Filters</span>
      </Button>
    </OverlayTrigger>
  );
});

FiltersButton.displayName = 'FiltersButton';

export default FiltersButton; 