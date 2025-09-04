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
    <Popover id="filters-popover" className="modern-filter-popover" style={{
      border: 'none',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
      borderRadius: '1rem',
      minWidth: '220px',
      maxWidth: '250px',
      width: '225px'
    }}>
      <Popover.Header className="modern-filter-header" style={{
        background: 'linear-gradient(135deg, #4db3b3 0%, #3a9a9a 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '1rem 1rem 0 0',
        padding: '1rem',
        fontSize: '1rem'
      }}>
        <div className="d-flex align-items-center gap-2">
          <FiFilter size={18} />
          <span className="fw-semibold">Filter Options</span>
        </div>
      </Popover.Header>
      <Popover.Body className="modern-filter-body" style={{
        padding: '1rem',
        background: '#ffffff',
        borderRadius: '0 0 1rem 1rem'
      }}>
        {/* Presets */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{
            fontWeight: '600',
            color: '#374151',
            fontSize: '0.75rem',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.025em'
          }}>Quick Presets</div>
          <div style={{
            display: 'flex',
            gap: '0.25rem',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            {presets.map(p => (
              <Button 
                key={p.label} 
                size="sm" 
                variant="outline-primary"
                onClick={() => { const r = p.get(); setStart(r.start); setEnd(r.end); }}
                style={{
                  border: '2px solid #4db3b3',
                  color: '#4db3b3',
                  background: 'transparent',
                  borderRadius: '0.5rem',
                  fontWeight: '500',
                  padding: '0.25rem 0.5rem',
                  transition: 'all 0.2s ease',
                  minWidth: '60px',
                  textAlign: 'center',
                  fontSize: '0.75rem'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#4db3b3';
                  e.target.style.color = 'white';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 4px 12px rgba(77, 179, 179, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'transparent';
                  e.target.style.color = '#4db3b3';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Cranes */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{
            fontWeight: '600',
            color: '#374151',
            fontSize: '0.75rem',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.025em'
          }}>Crane Selection</div>
          <div style={{
            border: '2px solid #e5e7eb',
            borderRadius: '0.5rem',
            padding: '0.75rem',
            background: '#f9fafb'
          }}>
            <div style={{
              display: 'flex',
              gap: '0.25rem',
              marginBottom: '0.75rem',
              justifyContent: 'center'
            }}>
              <Button 
                size="sm" 
                variant="outline-secondary" 
                onClick={() => setSelectedCranes(cranes)}
                style={{
                  borderRadius: '0.375rem',
                  fontWeight: '500',
                  padding: '0.25rem 0.5rem',
                  transition: 'all 0.2s ease',
                  flex: 1,
                  border: '2px solid #6c757d',
                  color: '#6c757d',
                  fontSize: '0.7rem'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                  e.target.style.background = '#6c757d';
                  e.target.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = 'transparent';
                  e.target.style.color = '#6c757d';
                }}
              >
                Select All
              </Button>
              <Button 
                size="sm" 
                variant="outline-secondary" 
                onClick={() => setSelectedCranes([])}
                style={{
                  borderRadius: '0.375rem',
                  fontWeight: '500',
                  padding: '0.25rem 0.5rem',
                  transition: 'all 0.2s ease',
                  flex: 1,
                  border: '2px solid #6c757d',
                  color: '#6c757d',
                  fontSize: '0.7rem'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                  e.target.style.background = '#6c757d';
                  e.target.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = 'transparent';
                  e.target.style.color = '#6c757d';
                }}
              >
                Clear All
              </Button>
            </div>
            <div style={{
              maxHeight: '120px',
              overflowY: 'auto',
              paddingRight: '0.25rem'
            }}>
              {cranes.map(id => {
                const isSelected = selectedCranes.includes(id);
                return (
                  <div
                    key={id}
                    onClick={() => toggleCrane(id)}
                    style={{
                      padding: '0.5rem',
                      background: isSelected ? '#4db3b3' : 'white',
                      color: isSelected ? 'white' : '#374151',
                      borderRadius: '0.375rem',
                      border: isSelected ? '2px solid #4db3b3' : '2px solid #e5e7eb',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                      marginBottom: '0.25rem',
                      fontWeight: '500',
                      fontSize: '0.75rem',
                      textAlign: 'center',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#f8fafc';
                        e.currentTarget.style.borderColor = '#4db3b3';
                      } else {
                        e.currentTarget.style.background = '#3a9a9a';
                        e.currentTarget.style.borderColor = '#3a9a9a';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      } else {
                        e.currentTarget.style.background = '#4db3b3';
                        e.currentTarget.style.borderColor = '#4db3b3';
                      }
                    }}
                  >
                    {isSelected && (
                      <span style={{
                        position: 'absolute',
                        left: '0.5rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '0.8rem'
                      }}>✓</span>
                    )}
                    {id}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Date range */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{
            fontWeight: '600',
            color: '#374151',
            fontSize: '0.75rem',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.025em'
          }}>Date Range</div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <Form.Control 
              type="date" 
              size="sm" 
              value={start} 
              onChange={(e) => setStart(e.target.value)} 
              placeholder="Start date"
              style={{
                border: '2px solid #e5e7eb',
                borderRadius: '0.375rem',
                padding: '0.5rem 0.75rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                fontSize: '0.75rem'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#4db3b3';
                e.target.style.boxShadow = '0 0 0 0.2rem rgba(77, 179, 179, 0.25)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.boxShadow = 'none';
              }}
            />
            <div style={{
              textAlign: 'center',
              fontWeight: '600',
              color: '#6b7280',
              fontSize: '0.7rem'
            }}>to</div>
            <Form.Control 
              type="date" 
              size="sm" 
              value={end} 
              onChange={(e) => setEnd(e.target.value)} 
              placeholder="End date"
              style={{
                border: '2px solid #e5e7eb',
                borderRadius: '0.375rem',
                padding: '0.5rem 0.75rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                fontSize: '0.75rem'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#4db3b3';
                e.target.style.boxShadow = '0 0 0 0.2rem rgba(77, 179, 179, 0.25)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.5rem',
          marginTop: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #e5e7eb'
        }}>
          <Button 
            size="sm" 
            variant="outline-secondary" 
            onClick={() => { setSelectedCranes([]); setStart(''); setEnd(''); onReset?.(); }}
            style={{
              borderRadius: '0.375rem',
              fontWeight: '500',
              padding: '0.5rem 0.75rem',
              transition: 'all 0.2s ease',
              flex: 1,
              border: '2px solid #6c757d',
              color: '#6c757d',
              background: 'transparent',
              fontSize: '0.7rem'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
              e.target.style.background = '#6c757d';
              e.target.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
              e.target.style.background = 'transparent';
              e.target.style.color = '#6c757d';
            }}
          >
            Reset
          </Button>
          <Button 
            size="sm" 
            variant="primary"
            onClick={() => { onApply?.({ cranes: selectedCranes, start, end }); setShow(false); }}
            style={{
              background: 'linear-gradient(135deg, #4db3b3 0%, #3a9a9a 100%)',
              border: 'none',
              borderRadius: '0.375rem',
              fontWeight: '600',
              padding: '0.5rem 0.75rem',
              transition: 'all 0.2s ease',
              flex: 1,
              color: 'white',
              fontSize: '0.7rem'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #3a9a9a 0%, #2d7a7a 100%)';
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 4px 12px rgba(77, 179, 179, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'linear-gradient(135deg, #4db3b3 0%, #3a9a9a 100%)';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            Apply
          </Button>
        </div>
      </Popover.Body>
    </Popover>
  );

  return (
    <OverlayTrigger 
      trigger="click" 
      placement="bottom-start" 
      rootClose 
      overlay={popover}
      show={show}
      onToggle={(nextShow) => setShow(nextShow)}
      popperConfig={{
        modifiers: [
          {
            name: 'offset',
            options: {
              offset: [-20, 8],
            },
          },
          {
            name: 'preventOverflow',
            options: {
              boundary: 'viewport',
              padding: 16,
            },
          },
        ],
      }}
    >
      <Button 
        size="sm" 
        variant="outline-primary"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          height: '2.25rem',
          padding: '0 0.75rem',
          borderRadius: '0.5rem',
          border: '2px solid #4db3b3',
          color: '#4db3b3',
          background: 'transparent',
          fontWeight: '500',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = '#4db3b3';
          e.target.style.color = 'white';
          e.target.style.transform = 'translateY(-1px)';
          e.target.style.boxShadow = '0 4px 12px rgba(77, 179, 179, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'transparent';
          e.target.style.color = '#4db3b3';
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = 'none';
        }}
      >
        <FiFilter size={16} />
        <span>Filters</span>
      </Button>
    </OverlayTrigger>
  );
});

FiltersButton.displayName = 'FiltersButton';

export default FiltersButton; 