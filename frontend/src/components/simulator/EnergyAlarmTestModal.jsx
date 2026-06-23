import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Button,
  Form,
  Table,
  Badge,
  Spinner,
  Alert,
  Collapse,
  ButtonGroup,
} from 'react-bootstrap';
import { AlertTriangle, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import axios from 'axios';
import {
  formatValueWithUnit,
  getMetricUnit,
} from '../energy/energyAlarmConfig';
import styles from './EnergyAlarmTestModal.module.css';

function formatRemaining(ms) {
  if (ms == null) return 'No limit';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function severityBadge(severity) {
  return (
    <Badge bg={severity === 'critical' ? 'danger' : 'warning'} className="text-uppercase">
      {severity}
    </Badge>
  );
}

export default function EnergyAlarmTestModal({ show, deviceId, onHide, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [breachMode, setBreachMode] = useState('standard');
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [durationMinutes, setDurationMinutes] = useState('');
  const [triggering, setTriggering] = useState('');
  const [activeOverride, setActiveOverride] = useState(null);
  const [remainingMs, setRemainingMs] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedReadings, setAdvancedReadings] = useState({
    voltage: '',
    current: '',
    activePower: '',
    energy: '',
    powerFactor: '',
    frequency: '',
  });
  const [burstRunning, setBurstRunning] = useState('');

  const loadPlan = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`/api/sim/energy-alarm-test-plan/${encodeURIComponent(deviceId)}`, {
        withCredentials: true,
      });
      setPlan(res.data);
      setActiveOverride(res.data.activeOverride || null);
      setRemainingMs(res.data.activeOverride?.remainingMs ?? null);
      setSelectedKeys(new Set());
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load alarm test plan');
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    if (show && deviceId) loadPlan();
  }, [show, deviceId, loadPlan]);

  useEffect(() => {
    if (!show || remainingMs == null) return undefined;
    const timer = setInterval(() => {
      setRemainingMs((prev) => {
        if (prev == null) return null;
        const next = Math.max(0, prev - 1000);
        if (next <= 0) loadPlan();
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [show, remainingMs, loadPlan]);

  const allRuleItems = useMemo(() => {
    if (!plan?.rulesByMetric) return [];
    return plan.rulesByMetric.flatMap((g) => g.rules);
  }, [plan]);

  const selectedBounds = useMemo(() => {
    return allRuleItems.filter((r) => selectedKeys.has(r.selectionKey));
  }, [allRuleItems, selectedKeys]);

  const expectedOutcomes = useMemo(() => {
    return selectedBounds.map((r) => ({
      ...r,
      generatedBreachValue: r.breachValues?.[breachMode],
      expectedResult: r.triggerDelayMinutes > 0
        ? `Will NOT fire on first ingest; requires ${r.triggerDelayMinutes} min continuous violation`
        : 'Active alarm should trigger on next ingest',
    }));
  }, [selectedBounds, breachMode]);

  const toggleKey = (key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelectedKeys(new Set(allRuleItems.map((r) => r.selectionKey)));
  const clearAll = () => setSelectedKeys(new Set());

  const selectBySeverity = (severity) => {
    setSelectedKeys(new Set(
      allRuleItems.filter((r) => r.severity === severity).map((r) => r.selectionKey)
    ));
  };

  const buildSelectionPayload = () => ({
    selections: selectedBounds.map((r) => ({
      ruleId: r.ruleId,
      boundType: r.boundType,
    })),
    selectAll: false,
    severity: null,
  });

  const handleTrigger = async (mode) => {
    if (!selectedBounds.length) {
      setError('Select at least one alarm rule');
      return;
    }
    setTriggering(mode);
    setError('');
    try {
      const res = await axios.post('/api/sim/energy-trigger-rules', {
        DeviceID: deviceId,
        mode,
        breachMode,
        durationMinutes: durationMinutes !== '' ? Number(durationMinutes) : null,
        selection: buildSelectionPayload(),
      }, { withCredentials: true });

      if (mode === 'live_override') {
        setActiveOverride(res.data.override);
        setRemainingMs(res.data.remainingMs);
      }
      onSuccess?.(res.data);
      if (mode === 'send_once') loadPlan();
    } catch (err) {
      setError(err.response?.data?.error || 'Trigger failed');
    } finally {
      setTriggering('');
    }
  };

  const handleQuickTrigger = async (mode, selection) => {
    setTriggering(`quick-${mode}`);
    setError('');
    try {
      const res = await axios.post('/api/sim/energy-trigger-rules', {
        DeviceID: deviceId,
        mode: 'send_once',
        breachMode,
        selection,
      }, { withCredentials: true });
      onSuccess?.(res.data);
      loadPlan();
    } catch (err) {
      setError(err.response?.data?.error || 'Quick trigger failed');
    } finally {
      setTriggering('');
    }
  };

  const handleRestore = async () => {
    setTriggering('restore');
    try {
      await axios.post('/api/sim/energy-reading-override/restore', { DeviceID: deviceId }, {
        withCredentials: true,
      });
      setActiveOverride(null);
      setRemainingMs(null);
      onSuccess?.({ restored: true });
      loadPlan();
    } catch (err) {
      setError(err.response?.data?.error || 'Restore failed');
    } finally {
      setTriggering('');
    }
  };

  const handleAdvancedSend = async () => {
    const readings = {};
    Object.entries(advancedReadings).forEach(([k, v]) => {
      if (v !== '' && v != null && Number.isFinite(Number(v))) readings[k] = Number(v);
    });
    if (!Object.keys(readings).length) {
      setError('Enter at least one reading in Advanced Mode');
      return;
    }
    setTriggering('advanced');
    try {
      await axios.post('/api/sim/energy-send-readings', { DeviceID: deviceId, readings }, {
        withCredentials: true,
      });
      onSuccess?.({ advanced: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Send failed');
    } finally {
      setTriggering('');
    }
  };

  const handleConsumptionBurst = async (ruleId) => {
    setBurstRunning(ruleId);
    setError('');
    try {
      const res = await axios.post('/api/sim/energy-consumption-burst', {
        DeviceID: deviceId,
        ruleId,
        breachMode,
      }, { withCredentials: true });
      onSuccess?.(res.data);
      loadPlan();
    } catch (err) {
      setError(err.response?.data?.error || 'Consumption burst failed');
    } finally {
      setBurstRunning('');
    }
  };

  const toggleGroupAll = (group) => {
    const keys = group.rules.map((r) => r.selectionKey);
    const allSelected = keys.every((k) => selectedKeys.has(k));
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => {
        if (allSelected) next.delete(k);
        else next.add(k);
      });
      return next;
    });
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" className={styles.alarmTestModal}>
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2">
          <Zap size={22} />
          Test Alarms — {deviceId}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

        {loading ? (
          <div className="text-center py-5"><Spinner animation="border" /></div>
        ) : !plan ? (
          <div className={styles.emptyState}>No alarm test data available.</div>
        ) : (
          <>
            {activeOverride?.enabled && (
              <div className={styles.overrideBanner}>
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                  <div>
                    <strong>OVERRIDE ACTIVE</strong>
                    <div className="small text-muted mt-1">{activeOverride.label || 'Live override'}</div>
                    <div className="small mt-1">
                      Remaining: <strong>{formatRemaining(remainingMs)}</strong>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline-dark"
                    onClick={handleRestore}
                    disabled={triggering === 'restore'}
                  >
                    {triggering === 'restore' ? <Spinner size="sm" /> : 'Restore Normal'}
                  </Button>
                </div>
              </div>
            )}

            <div className={styles.breachToggle}>
              <span className="me-2 fw-semibold">Breach mode:</span>
              <ButtonGroup size="sm">
                <Button
                  variant={breachMode === 'standard' ? 'primary' : 'outline-primary'}
                  onClick={() => setBreachMode('standard')}
                >
                  Standard
                </Button>
                <Button
                  variant={breachMode === 'aggressive' ? 'danger' : 'outline-danger'}
                  onClick={() => setBreachMode('aggressive')}
                >
                  Aggressive
                </Button>
              </ButtonGroup>
            </div>

            <div className={styles.quickActions}>
              <Button size="sm" variant="outline-warning" onClick={() => selectBySeverity('warning')}>
                Select Warning
              </Button>
              <Button size="sm" variant="outline-danger" onClick={() => selectBySeverity('critical')}>
                Select Critical
              </Button>
              <Button size="sm" variant="outline-secondary" onClick={selectAll}>Select All</Button>
              <Button size="sm" variant="outline-secondary" onClick={clearAll}>Clear</Button>
              <div className="vr d-none d-md-block" />
              <Button
                size="sm"
                variant="warning"
                disabled={!!triggering || !plan.counts?.warning}
                onClick={() => handleQuickTrigger('warning', { severity: 'warning' })}
              >
                Trigger Warning Alarms
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={!!triggering || !plan.counts?.critical}
                onClick={() => handleQuickTrigger('critical', { severity: 'critical' })}
              >
                Trigger Critical Alarms
              </Button>
              <Button
                size="sm"
                variant="dark"
                disabled={!!triggering || !plan.counts?.total}
                onClick={() => handleQuickTrigger('all', { selectAll: true })}
              >
                Trigger All Alarms
              </Button>
            </div>

            {allRuleItems.length === 0 ? (
              <Alert variant="info">
                No enabled instant-metric alarm rules. Create rules in Fleet Alarms first.
              </Alert>
            ) : (
              plan.rulesByMetric.map((group) => (
                <div key={group.metric} className={styles.metricGroup}>
                  <div className={styles.metricGroupHeader}>
                    <span>{group.label}</span>
                    <Form.Check
                      type="checkbox"
                      label="Select all"
                      checked={group.rules.every((r) => selectedKeys.has(r.selectionKey))}
                      onChange={() => toggleGroupAll(group)}
                    />
                  </div>
                  {group.rules.map((rule) => (
                    <div key={rule.selectionKey} className={styles.ruleRow}>
                      <Form.Check
                        checked={selectedKeys.has(rule.selectionKey)}
                        onChange={() => toggleKey(rule.selectionKey)}
                        aria-label={rule.displayName}
                      />
                      <div>
                        <div className="fw-semibold">{rule.displayName}</div>
                        <div className="small text-muted">{rule.conditionLabel}</div>
                      </div>
                      <span className="small">
                        {formatValueWithUnit(rule.breachValues?.[breachMode], group.metric)}
                      </span>
                      {severityBadge(rule.severity)}
                    </div>
                  ))}
                </div>
              ))
            )}

            {expectedOutcomes.length > 0 && (
              <>
                <h6 className="mt-3 mb-2 d-flex align-items-center gap-2">
                  <AlertTriangle size={16} />
                  Expected Outcome
                </h6>
                <Table responsive size="sm" striped className={styles.outcomeTable}>
                  <thead>
                    <tr>
                      <th>Rule</th>
                      <th>Threshold</th>
                      <th>Generated breach</th>
                      <th>Severity</th>
                      <th>Trigger delay</th>
                      <th>Expected result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expectedOutcomes.map((row) => (
                      <tr key={row.selectionKey}>
                        <td>{row.displayName}</td>
                        <td>{formatValueWithUnit(row.threshold, row.metric)}</td>
                        <td><strong>{formatValueWithUnit(row.generatedBreachValue, row.metric)}</strong></td>
                        <td>{severityBadge(row.severity)}</td>
                        <td>{row.triggerDelayMinutes || 0} min</td>
                        <td className="small">{row.expectedResult}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </>
            )}

            {plan.consumptionRules?.length > 0 && (
              <>
                <h6 className="mt-4 mb-2">Consumption Alarms</h6>
                <p className="small text-muted">
                  Based on register delta over time — uses a multi-step burst, not a single reading override.
                </p>
                {plan.consumptionRules.map((rule) => (
                  <div key={rule.ruleId} className={styles.consumptionCard}>
                    <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                      <div>
                        <div className="fw-semibold">{rule.conditionLabel}</div>
                        <div className="small text-muted">{rule.expectedResult}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        disabled={burstRunning === rule.ruleId}
                        onClick={() => handleConsumptionBurst(rule.ruleId)}
                      >
                        {burstRunning === rule.ruleId ? <Spinner size="sm" /> : 'Run Consumption Burst'}
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className={styles.advancedSection}>
              <Button
                variant="link"
                className="p-0 text-decoration-none d-flex align-items-center gap-1"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Advanced — Custom Readings
              </Button>
              <Collapse in={showAdvanced}>
                <div className="mt-3">
                  <p className="small text-muted">
                    Engineering mode: send arbitrary readings once (bypasses rule-based breach generation).
                  </p>
                  <div className="row g-2">
                    {['voltage', 'current', 'activePower', 'energy', 'powerFactor', 'frequency'].map((key) => (
                      <div className="col-md-4" key={key}>
                        <Form.Group>
                          <Form.Label className="small mb-0">{key}</Form.Label>
                          <Form.Control
                            size="sm"
                            type="number"
                            step="any"
                            value={advancedReadings[key]}
                            onChange={(e) => setAdvancedReadings((p) => ({ ...p, [key]: e.target.value }))}
                            placeholder={`${key}${getMetricUnit(key) ? ` (${getMetricUnit(key)})` : ''}`}
                          />
                        </Form.Group>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="mt-2"
                    size="sm"
                    variant="secondary"
                    disabled={triggering === 'advanced'}
                    onClick={handleAdvancedSend}
                  >
                    {triggering === 'advanced' ? <Spinner size="sm" /> : 'Send Once (Advanced)'}
                  </Button>
                </div>
              </Collapse>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Form.Group className="me-auto d-flex align-items-center gap-2 mb-0">
          <Form.Label className="mb-0 small">Override duration (min)</Form.Label>
          <Form.Control
            size="sm"
            type="number"
            min="1"
            style={{ width: 90 }}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            placeholder="∞"
          />
        </Form.Group>
        <Button variant="secondary" onClick={onHide}>Close</Button>
        <Button
          variant="primary"
          disabled={!!triggering || !selectedBounds.length}
          onClick={() => handleTrigger('send_once')}
        >
          {triggering === 'send_once' ? <Spinner size="sm" /> : 'Send Once'}
        </Button>
        <Button
          variant="warning"
          disabled={!!triggering || !selectedBounds.length}
          onClick={() => handleTrigger('live_override')}
        >
          {triggering === 'live_override' ? <Spinner size="sm" /> : 'Live Override'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
