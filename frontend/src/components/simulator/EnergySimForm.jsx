import React, { useState } from 'react';
import { Row, Col, Form, Button, Table, Collapse } from 'react-bootstrap';
import { Plus, Trash2 } from 'lucide-react';

const INTERVAL_OPTIONS = [30, 60, 120, 180, 300];

const DEFAULT_APPLIANCE_ROW = { type: 'lights_led', count: 1, ratedKwOverride: '' };

export function buildEnergyPreviewBody(formData, deviceIdOverride) {
  return {
    deviceType: 'energyMeter',
    deviceId: formData.DeviceID || deviceIdOverride || 'Energy Meter_1',
    DeviceID: deviceIdOverride || undefined,
    state: formData.state,
    jitter: formData.jitter,
    energyBaseReading: formData.energyBaseReading,
    intervalSeconds: Number(formData.intervalSeconds),
    energySimMode: formData.energySimMode,
    roomType: formData.roomType,
    appliances: (formData.appliances || []).map((row) => ({
      type: row.type,
      count: Number(row.count) || 1,
      ratedKwOverride: row.ratedKwOverride === '' || row.ratedKwOverride == null
        ? undefined : Number(row.ratedKwOverride),
    })),
    singleApplianceType: formData.singleApplianceType,
    singleApplianceRatedKwOverride: formData.singleApplianceRatedKwOverride === ''
      ? undefined : Number(formData.singleApplianceRatedKwOverride),
    occupancyPercent: Number(formData.occupancyPercent),
    minVoltage: Number(formData.minVoltage),
    maxVoltage: Number(formData.maxVoltage),
  };
}

export function buildEnergyAddPayload(formData) {
  const body = buildEnergyPreviewBody(formData);
  return {
    deviceType: 'energyMeter',
    DeviceID: formData.DeviceID,
    state: body.state,
    intervalSeconds: body.intervalSeconds,
    jitter: body.jitter,
    energyBaseReading: Number(formData.energyBaseReading),
    energySimMode: body.energySimMode,
    roomType: body.roomType,
    appliances: body.appliances,
    singleApplianceType: body.singleApplianceType,
    singleApplianceRatedKwOverride: body.singleApplianceRatedKwOverride,
    occupancyPercent: body.occupancyPercent,
    minVoltage: body.minVoltage,
    maxVoltage: body.maxVoltage,
  };
}

export default function EnergySimForm({
  formData,
  onChange,
  catalog,
  deviceIdDisabled = false,
  showDeviceId = true,
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const appliances = catalog?.appliances || [];
  const roomTypes = catalog?.roomTypes || [];
  const applianceById = Object.fromEntries(appliances.map((a) => [a.id, a]));

  const handleField = (e) => {
    const { name, value, type, checked } = e.target;
    onChange({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleModeChange = (mode) => {
    const next = { ...formData, energySimMode: mode };
    if (mode === 'room' && (!formData.appliances || !formData.appliances.length)) {
      const preset = roomTypes.find((r) => r.id === formData.roomType)?.preset || [];
      next.appliances = preset.length
        ? preset.map((p) => ({ type: p.type, count: p.count, ratedKwOverride: '' }))
        : [{ ...DEFAULT_APPLIANCE_ROW }];
    }
    onChange(next);
  };

  const loadRoomPreset = () => {
    const preset = roomTypes.find((r) => r.id === formData.roomType)?.preset || [];
    if (!preset.length) return;
    onChange({
      ...formData,
      appliances: preset.map((p) => ({ type: p.type, count: p.count, ratedKwOverride: '' })),
    });
  };

  const updateApplianceRow = (index, patch) => {
    const rows = [...(formData.appliances || [])];
    rows[index] = { ...rows[index], ...patch };
    onChange({ ...formData, appliances: rows });
  };

  const addApplianceRow = () => {
    onChange({
      ...formData,
      appliances: [...(formData.appliances || []), { ...DEFAULT_APPLIANCE_ROW }],
    });
  };

  const removeApplianceRow = (index) => {
    const rows = (formData.appliances || []).filter((_, i) => i !== index);
    onChange({ ...formData, appliances: rows.length ? rows : [{ ...DEFAULT_APPLIANCE_ROW }] });
  };

  const isRoom = formData.energySimMode === 'room';
  const singleCfg = applianceById[formData.singleApplianceType];

  return (
    <Form>
      <Form.Group className="mb-3">
        <Form.Label>Connection type</Form.Label>
        <div className="d-flex gap-3">
          <Form.Check
            type="radio"
            id="energy-mode-room"
            label="Room (aggregated meter)"
            checked={isRoom}
            onChange={() => handleModeChange('room')}
          />
          <Form.Check
            type="radio"
            id="energy-mode-single"
            label="Single device"
            checked={!isRoom}
            onChange={() => handleModeChange('single')}
          />
        </div>
      </Form.Group>

      <Row>
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label>Environment / room type</Form.Label>
            <Form.Select name="roomType" value={formData.roomType || 'office'} onChange={handleField}>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>{rt.label}</option>
              ))}
            </Form.Select>
            <Form.Text className="text-muted">Drives IST schedule (office hours, shifts, etc.)</Form.Text>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group className="mb-3">
            <Form.Label>Occupancy / utilization (%)</Form.Label>
            <Form.Range
              name="occupancyPercent"
              min={0}
              max={100}
              value={formData.occupancyPercent ?? 100}
              onChange={handleField}
            />
            <Form.Text>{formData.occupancyPercent ?? 100}% — scales load activity</Form.Text>
          </Form.Group>
        </Col>
      </Row>

      {isRoom ? (
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <Form.Label className="mb-0">Appliances in room</Form.Label>
            <Button variant="outline-secondary" size="sm" type="button" onClick={loadRoomPreset}>
              Load preset
            </Button>
          </div>
          <Table size="sm" bordered responsive className="mb-2">
            <thead>
              <tr>
                <th>Appliance</th>
                <th style={{ width: 80 }}>Count</th>
                <th style={{ width: 110 }}>Rated kW</th>
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {(formData.appliances || []).map((row, idx) => (
                <tr key={`appliance-${idx}`}>
                  <td>
                    <Form.Select
                      size="sm"
                      value={row.type}
                      onChange={(e) => updateApplianceRow(idx, { type: e.target.value })}
                    >
                      {appliances.map((a) => (
                        <option key={a.id} value={a.id}>{a.label}</option>
                      ))}
                    </Form.Select>
                  </td>
                  <td>
                    <Form.Control
                      size="sm"
                      type="number"
                      min={1}
                      value={row.count}
                      onChange={(e) => updateApplianceRow(idx, { count: e.target.value })}
                    />
                  </td>
                  <td>
                    <Form.Control
                      size="sm"
                      type="number"
                      step="0.1"
                      placeholder={applianceById[row.type]?.defaultRatedKw ?? '—'}
                      value={row.ratedKwOverride ?? ''}
                      onChange={(e) => updateApplianceRow(idx, { ratedKwOverride: e.target.value })}
                    />
                  </td>
                  <td className="text-center">
                    <Button variant="outline-danger" size="sm" type="button" onClick={() => removeApplianceRow(idx)}>
                      <Trash2 size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Button variant="outline-primary" size="sm" type="button" onClick={addApplianceRow}>
            <Plus size={14} className="me-1" /> Add appliance
          </Button>
        </div>
      ) : (
        <Row className="mb-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label>Appliance</Form.Label>
              <Form.Select name="singleApplianceType" value={formData.singleApplianceType || 'ac_split'} onChange={handleField}>
                {appliances.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Rated kW override</Form.Label>
              <Form.Control
                type="number"
                step="0.1"
                name="singleApplianceRatedKwOverride"
                placeholder={singleCfg?.defaultRatedKw ?? 'Default'}
                value={formData.singleApplianceRatedKwOverride ?? ''}
                onChange={handleField}
              />
            </Form.Group>
          </Col>
        </Row>
      )}

      <Row>
        {showDeviceId && (
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Device ID *</Form.Label>
              <Form.Control
                name="DeviceID"
                value={formData.DeviceID}
                onChange={handleField}
                placeholder="Energy Meter_1"
                required
                disabled={deviceIdDisabled}
                className={deviceIdDisabled ? 'bg-light' : ''}
              />
            </Form.Group>
          </Col>
        )}
        <Col md={showDeviceId ? 6 : 12}>
          <Form.Group className="mb-3">
            <Form.Label>Update interval *</Form.Label>
            <Form.Select name="intervalSeconds" value={formData.intervalSeconds} onChange={handleField}>
              {INTERVAL_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} seconds</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>

      <Row>
        <Col md={4}>
          <Form.Group className="mb-3">
            <Form.Label>State</Form.Label>
            <Form.Select name="state" value={formData.state} onChange={handleField}>
              <option value="working">Working</option>
              <option value="idle">Idle</option>
              <option value="maintenance">Maintenance</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group className="mb-3">
            <Form.Label>Base energy (kWh)</Form.Label>
            <Form.Control
              type="number"
              name="energyBaseReading"
              value={formData.energyBaseReading}
              onChange={handleField}
              step="0.1"
            />
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Label className="d-block">Options</Form.Label>
          <Form.Check type="checkbox" name="jitter" checked={formData.jitter} onChange={handleField} label="Value jitter" />
        </Col>
      </Row>

      <Button
        variant="link"
        className="px-0 mb-2 text-decoration-none"
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? 'Hide' : 'Show'} advanced voltage limits
      </Button>
      <Collapse in={showAdvanced}>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Min voltage (V)</Form.Label>
              <Form.Control type="number" name="minVoltage" value={formData.minVoltage ?? 220} onChange={handleField} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Max voltage (V)</Form.Label>
              <Form.Control type="number" name="maxVoltage" value={formData.maxVoltage ?? 240} onChange={handleField} />
            </Form.Group>
          </Col>
        </Row>
      </Collapse>
    </Form>
  );
}

export function EnergySimPayloadPreview({ payload, loading }) {
  if (loading) {
    return <div className="text-center py-2"><span className="spinner-border spinner-border-sm" /></div>;
  }
  if (!payload?.payload) {
    return <p className="text-muted small mb-0">No preview available</p>;
  }

  const r = payload.readings || {};
  const breakdown = payload.breakdown;

  return (
    <>
      <div className="small mb-2 p-2 bg-light rounded border">
        <strong>Decoded readings:</strong>{' '}
        {r.voltage != null && `${r.voltage} V`}
        {r.current != null && ` · ${r.current} A`}
        {r.activePower != null && ` · ${r.activePower} kW`}
        {r.energy != null && ` · ${r.energy} kWh`}
        {r.powerFactor != null && ` · ${r.powerFactor} PF`}
        {r.frequency != null && ` · ${r.frequency} Hz`}
      </div>
      {breakdown?.items?.length > 0 && (
        <div className="small mb-2 p-2 bg-white rounded border">
          <strong>Contributing loads</strong>
          <Table size="sm" className="mb-1 mt-1">
            <tbody>
              {breakdown.items.filter((it) => it.kw > 0).map((it) => (
                <tr key={`${it.type}-${it.label}`}>
                  <td>{it.label} ×{it.count}</td>
                  <td className="text-end">{it.kw} kW</td>
                </tr>
              ))}
              <tr className="fw-semibold border-top">
                <td>Total</td>
                <td className="text-end">{breakdown.totalKw} kW</td>
              </tr>
            </tbody>
          </Table>
        </div>
      )}
      <pre
        className="bg-dark text-success p-2 rounded small mb-0"
        style={{ maxHeight: 140, overflow: 'auto', fontSize: '0.75rem' }}
      >
        {JSON.stringify(payload.payload, null, 2)}
      </pre>
    </>
  );
}
