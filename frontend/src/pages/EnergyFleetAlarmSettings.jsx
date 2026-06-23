import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Col, Row, Card, Table, Button, Modal, Badge, Spinner, Form, Dropdown } from 'react-bootstrap';
import { Bell, Plus, Pencil, Trash2 } from 'lucide-react';
import EnergyMeterAlarmRuleForm from '../components/energy/EnergyMeterAlarmRuleForm';
import {
  EMPTY_RULE_FORM,
  ruleToForm,
  formToPayload,
  validateRuleForm,
  getMetricLabel,
  formatValueWithUnit,
  ALARM_METRICS,
  SEVERITY_OPTIONS,
} from '../components/energy/energyAlarmConfig';
import styles from './EnergyFleetAlarmSettings.module.css';
import { formatMeterDisplayLabel } from '../components/energy/energyChartShared';
import {
  loadFleetAlarmDraft,
  clearFleetAlarmDraft,
} from '../components/energy/alarmFormDraft';
import {
  useFleetAlarmFormDraft,
  getFleetDraftInitialState,
  hasRestorableCreateDraft,
} from '../components/energy/useAlarmFormDraft';

const fleetInitial = getFleetDraftInitialState();

export default function EnergyFleetAlarmSettings() {
  const [rules, setRules] = useState([]);
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(fleetInitial.showModal);
  const [editingRule, setEditingRule] = useState(null);
  const [form, setForm] = useState(fleetInitial.form);
  const [formErrors, setFormErrors] = useState([]);
  const [draftEditRuleId] = useState(fleetInitial.editingRuleId);
  const [filterMeterIds, setFilterMeterIds] = useState([]);
  const [filterMetric, setFilterMetric] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterEnabled, setFilterEnabled] = useState('');

  const { persistNow } = useFleetAlarmFormDraft({ form, showModal, editingRule });

  const handleFormChange = (nextForm) => {
    setForm(nextForm);
    persistNow({ form: nextForm, showModal, editingRuleId: editingRule?._id || null });
  };

  const resumeDraft = () => {
    const draft = loadFleetAlarmDraft();
    if (!draft) return;
    setEditingRule(null);
    setForm(draft.form);
    setFormErrors([]);
    setShowModal(true);
    persistNow({
      form: draft.form,
      showModal: true,
      editingRuleId: draft.editingRuleId,
    });
  };

  const savedDraft = loadFleetAlarmDraft();
  const showDraftBanner =
    !showModal && hasRestorableCreateDraft(savedDraft);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [rulesRes, overviewRes] = await Promise.all([
        axios.get('/api/energy-meter/alarms/rules', { withCredentials: true }),
        axios.get('/api/energy-meter/overview', { withCredentials: true }),
      ]);
      setRules(rulesRes.data.data || []);
      setMeters(overviewRes.data?.meters || []);
    } catch (err) {
      console.error('Failed to load fleet alarm settings', err);
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!draftEditRuleId || !rules.length) return;
    const rule = rules.find((r) => r._id === draftEditRuleId);
    if (rule) setEditingRule(rule);
  }, [draftEditRuleId, rules]);

  const closeModal = () => {
    setShowModal(false);
    setFormErrors([]);
    persistNow({ showModal: false });
  };

  const filtered = rules.filter((rule) => {
    if (filterMeterIds.length > 0 && !filterMeterIds.includes(rule.meterId)) return false;
    if (filterMetric && rule.metric !== filterMetric) return false;
    if (filterSeverity && rule.severity !== filterSeverity) return false;
    if (filterEnabled === 'true' && rule.enabled === false) return false;
    if (filterEnabled === 'false' && rule.enabled !== false) return false;
    return true;
  });

  const openCreate = () => {
    const draft = loadFleetAlarmDraft();
    setEditingRule(null);
    let nextForm;
    if (draft && !draft.editingRuleId) {
      nextForm = draft.form;
    } else {
      nextForm = { ...EMPTY_RULE_FORM, meterId: meters[0]?.meterId || '' };
    }
    setForm(nextForm);
    setFormErrors([]);
    setShowModal(true);
    persistNow({ form: nextForm, showModal: true, editingRuleId: null });
  };

  const openEdit = (rule) => {
    const nextForm = { ...ruleToForm(rule), meterId: rule.meterId };
    setEditingRule(rule);
    setForm(nextForm);
    setFormErrors([]);
    setShowModal(true);
    persistNow({ form: nextForm, showModal: true, editingRuleId: rule._id });
  };

  const handleSave = async () => {
    const errors = validateRuleForm(form);
    if (!form.meterId) errors.push('Select a meter.');
    if (errors.length) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const payload = { ...formToPayload(form), meterId: form.meterId };
      if (editingRule) {
        await axios.put(`/api/energy-meter/alarms/rules/${editingRule._id}`, payload, {
          withCredentials: true,
        });
      } else {
        await axios.post('/api/energy-meter/alarms/rules', payload, {
          withCredentials: true,
        });
      }
      setShowModal(false);
      clearFleetAlarmDraft();
      await fetchData();
    } catch (err) {
      setFormErrors([err.response?.data?.message || 'Failed to save rule']);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId) => {
    if (!window.confirm('Delete this alarm rule?')) return;
    try {
      await axios.delete(`/api/energy-meter/alarms/rules/${ruleId}`, { withCredentials: true });
      await fetchData();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleToggle = async (rule) => {
    try {
      await axios.patch(
        `/api/energy-meter/alarms/rules/${rule._id}/toggle`,
        { enabled: !rule.enabled },
        { withCredentials: true }
      );
      await fetchData();
    } catch (err) {
      console.error('Toggle failed', err);
    }
  };

  const toggleFilterMeter = (meterId) => {
    setFilterMeterIds((prev) =>
      prev.includes(meterId) ? prev.filter((id) => id !== meterId) : [...prev, meterId]
    );
  };

  const toggleSelectAllFilterMeters = () => {
    const allSelected =
      meters.length > 0 && filterMeterIds.length === meters.length;
    setFilterMeterIds(allSelected ? [] : meters.map((m) => m.meterId));
  };

  const allMetersSelected =
    meters.length > 0 && filterMeterIds.length === meters.length;

  const meterFilterLabel = () => {
    if (!filterMeterIds.length) return 'All meters';
    if (filterMeterIds.length === 1) {
      const m = meters.find((x) => x.meterId === filterMeterIds[0]);
      return m ? formatMeterDisplayLabel(m.meterId, m.machineName) : filterMeterIds[0];
    }
    return `${filterMeterIds.length} meters selected`;
  };

  return (
    <Col xs={12} className={styles.page}>
      <div className={styles.header}>
        <div>
          <h5 className={styles.title}>
            <Bell size={20} className="me-2" />
            Fleet Alarm Settings
          </h5>
          <p className={styles.subtitle}>Manage alarm rules across all energy meters</p>
        </div>
        <Button variant="primary" onClick={openCreate} disabled={!meters.length}>
          <Plus size={16} className="me-1" />
          Add Rule
        </Button>
      </div>

      {showDraftBanner && (
        <div className={styles.draftBanner}>
          <span>You have an unsaved alarm rule draft.</span>
          <Button size="sm" variant="outline-primary" onClick={resumeDraft}>
            Continue editing
          </Button>
        </div>
      )}

      <Card className={styles.toolbar}>
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col md={4}>
              <Form.Label className="small mb-1">Meters</Form.Label>
              <Dropdown className={styles.meterDropdown} autoClose="outside">
                <Dropdown.Toggle
                  variant="outline-secondary"
                  className={styles.meterDropdownToggle}
                  disabled={!meters.length}
                >
                  {meterFilterLabel()}
                </Dropdown.Toggle>
                <Dropdown.Menu className={styles.meterDropdownMenu}>
                  <Dropdown.Item onClick={toggleSelectAllFilterMeters}>
                    {allMetersSelected ? 'Deselect all' : 'Select all'}
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  {meters.map((m) => (
                    <div
                      key={m.meterId}
                      className={styles.meterCheck}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Form.Check
                        type="checkbox"
                        id={`filter-meter-${m.meterId}`}
                        label={formatMeterDisplayLabel(m.meterId, m.machineName)}
                        checked={filterMeterIds.includes(m.meterId)}
                        onChange={() => toggleFilterMeter(m.meterId)}
                      />
                    </div>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Col>
            <Col md={2}>
              <Form.Label className="small mb-1">Metric</Form.Label>
              <Form.Select value={filterMetric} onChange={(e) => setFilterMetric(e.target.value)}>
                <option value="">All</option>
                {Object.entries(ALARM_METRICS).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label className="small mb-1">Severity</Form.Label>
              <Form.Select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
                <option value="">All</option>
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label className="small mb-1">Enabled</Form.Label>
              <Form.Select value={filterEnabled} onChange={(e) => setFilterEnabled(e.target.value)}>
                <option value="">All</option>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>No alarm rules match your filters.</div>
          ) : (
            <div className={styles.tableWrap}>
              <Table hover responsive className="mb-0">
                <thead>
                  <tr>
                    <th>Meter</th>
                    <th>Metric</th>
                    <th>Min</th>
                    <th>Max</th>
                    <th>Severity</th>
                    <th>Enabled</th>
                    <th>Label</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((rule) => (
                    <tr key={rule._id}>
                      <td>{rule.meterId}</td>
                      <td>
                        {getMetricLabel(rule.metric)}
                        {rule.consumptionPeriod && (
                          <small className="d-block text-muted">{rule.consumptionPeriod}</small>
                        )}
                      </td>
                      <td>{formatValueWithUnit(rule.minThreshold, rule.metric)}</td>
                      <td>{formatValueWithUnit(rule.maxThreshold, rule.metric)}</td>
                      <td>
                        <Badge bg={rule.severity === 'critical' ? 'danger' : 'warning'}>
                          {rule.severity}
                        </Badge>
                      </td>
                      <td>
                        <Form.Check
                          type="switch"
                          checked={rule.enabled !== false}
                          onChange={() => handleToggle(rule)}
                        />
                      </td>
                      <td>{rule.label || '—'}</td>
                      <td className={styles.actions}>
                        <Button variant="link" size="sm" onClick={() => openEdit(rule)}>
                          <Pencil size={14} />
                        </Button>
                        <Button variant="link" size="sm" className="text-danger" onClick={() => handleDelete(rule._id)}>
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={closeModal} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingRule ? 'Edit Alarm Rule' : 'Add Alarm Rule'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Meter</Form.Label>
            <Form.Select
              value={form.meterId}
              onChange={(e) => handleFormChange({ ...form, meterId: e.target.value })}
              disabled={Boolean(editingRule)}
            >
              <option value="">Select meter</option>
              {meters.map((m) => (
                <option key={m.meterId} value={m.meterId}>
                  {formatMeterDisplayLabel(m.meterId, m.machineName)}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <EnergyMeterAlarmRuleForm form={form} onChange={handleFormChange} errors={formErrors} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Rule'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Col>
  );
}
