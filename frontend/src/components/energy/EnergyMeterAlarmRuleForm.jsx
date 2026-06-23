import React from 'react';
import { Form, Row, Col } from 'react-bootstrap';
import {
  ALARM_METRICS,
  CONSUMPTION_PERIODS,
  SEVERITY_OPTIONS,
} from './energyAlarmConfig';

export default function EnergyMeterAlarmRuleForm({ form, onChange, errors = [] }) {
  const metricCfg = ALARM_METRICS[form.metric];
  const unit = metricCfg?.unit || '';

  const handleChange = (field, value) => {
    onChange({ ...form, [field]: value });
  };

  return (
    <>
      {errors.length > 0 && (
        <div className="alert alert-danger py-2 small mb-3">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      <Form.Group className="mb-3">
        <Form.Label>Metric</Form.Label>
        <Form.Select
          value={form.metric}
          onChange={(e) => handleChange('metric', e.target.value)}
        >
          {Object.entries(ALARM_METRICS).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label}
            </option>
          ))}
        </Form.Select>
      </Form.Group>

      {form.metric === 'energyConsumption' && (
        <Form.Group className="mb-3">
          <Form.Label>Consumption period</Form.Label>
          <Form.Select
            value={form.consumptionPeriod}
            onChange={(e) => handleChange('consumptionPeriod', e.target.value)}
          >
            {CONSUMPTION_PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </Form.Select>
          <Form.Text className="text-muted">
            Energy alarms use kWh consumed in the period, not the cumulative meter register.
          </Form.Text>
        </Form.Group>
      )}

      <Row className="g-2 mb-3">
        <Col sm={6}>
          <Form.Group>
            <Form.Label>Min threshold{unit ? ` (${unit})` : ''}</Form.Label>
            <Form.Control
              type="number"
              step="any"
              placeholder="Optional"
              value={form.minThreshold}
              onChange={(e) => handleChange('minThreshold', e.target.value)}
            />
          </Form.Group>
        </Col>
        <Col sm={6}>
          <Form.Group>
            <Form.Label>Max threshold{unit ? ` (${unit})` : ''}</Form.Label>
            <Form.Control
              type="number"
              step="any"
              placeholder="Optional"
              value={form.maxThreshold}
              onChange={(e) => handleChange('maxThreshold', e.target.value)}
            />
          </Form.Group>
        </Col>
      </Row>

      <Row className="g-2 mb-3">
        <Col sm={6}>
          <Form.Group>
            <Form.Label>Severity</Form.Label>
            <Form.Select
              value={form.severity}
              onChange={(e) => handleChange('severity', e.target.value)}
            >
              {SEVERITY_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col sm={6}>
          <Form.Group>
            <Form.Label>Cooldown (minutes)</Form.Label>
            <Form.Control
              type="number"
              min={0}
              value={form.cooldownMinutes}
              onChange={(e) => handleChange('cooldownMinutes', e.target.value)}
            />
          </Form.Group>
        </Col>
      </Row>

      <Form.Group className="mb-3">
        <Form.Label>Label (optional)</Form.Label>
        <Form.Control
          type="text"
          placeholder="e.g. Main line overvoltage"
          value={form.label}
          onChange={(e) => handleChange('label', e.target.value)}
        />
      </Form.Group>

      <Form.Check
        type="switch"
        id="alarm-rule-enabled"
        label="Rule enabled"
        checked={form.enabled !== false}
        onChange={(e) => handleChange('enabled', e.target.checked)}
      />
    </>
  );
}
