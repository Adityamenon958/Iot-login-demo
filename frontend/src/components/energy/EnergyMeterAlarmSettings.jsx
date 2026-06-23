import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Card, Table, Button, Modal, Badge, Spinner, Form } from 'react-bootstrap';
import { Bell, Plus, Pencil, Trash2 } from 'lucide-react';
import EnergyMeterAlarmRuleForm from './EnergyMeterAlarmRuleForm';
import {
  EMPTY_RULE_FORM,
  ruleToForm,
  formToPayload,
  validateRuleForm,
  getMetricLabel,
  formatValueWithUnit,
} from './energyAlarmConfig';
import styles from './EnergyMeterAlarmSettings.module.css';
import {
  loadMeterAlarmDraft,
  clearMeterAlarmDraft,
} from './alarmFormDraft';
import {
  useMeterAlarmFormDraft,
  getMeterDraftInitialState,
  hasRestorableCreateDraft,
} from './useAlarmFormDraft';

export default function EnergyMeterAlarmSettings({ meterId, refreshKey = 0 }) {
  const meterInitial = getMeterDraftInitialState(meterId);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(meterInitial.showModal);
  const [editingRule, setEditingRule] = useState(null);
  const [form, setForm] = useState(meterInitial.form);
  const [formErrors, setFormErrors] = useState([]);
  const [draftEditRuleId] = useState(meterInitial.editingRuleId);

  const { persistNow } = useMeterAlarmFormDraft(meterId, { form, showModal, editingRule });

  const handleFormChange = (nextForm) => {
    setForm(nextForm);
    persistNow({ form: nextForm, showModal, editingRuleId: editingRule?._id || null });
  };

  const resumeDraft = () => {
    const draft = meterId ? loadMeterAlarmDraft(meterId) : null;
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

  const savedDraft = meterId ? loadMeterAlarmDraft(meterId) : null;
  const showDraftBanner = !showModal && hasRestorableCreateDraft(savedDraft);

  const fetchRules = useCallback(async () => {
    if (!meterId) return;
    try {
      setLoading(true);
      const res = await axios.get('/api/energy-meter/alarms/rules', {
        params: { meterId },
        withCredentials: true,
      });
      setRules(res.data.data || []);
    } catch (err) {
      console.error('Failed to load alarm rules', err);
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [meterId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules, refreshKey]);

  useEffect(() => {
    if (!draftEditRuleId || !rules.length) return;
    const rule = rules.find((r) => r._id === draftEditRuleId);
    if (rule) setEditingRule(rule);
  }, [draftEditRuleId, rules]);

  useEffect(() => {
    if (!meterId) return;
    const next = getMeterDraftInitialState(meterId);
    setForm(next.form);
    setShowModal(next.showModal);
  }, [meterId]);

  const closeModal = () => {
    setShowModal(false);
    setFormErrors([]);
    persistNow({ showModal: false });
  };

  const openCreate = () => {
    const draft = meterId ? loadMeterAlarmDraft(meterId) : null;
    setEditingRule(null);
    const nextForm = draft && !draft.editingRuleId ? draft.form : { ...EMPTY_RULE_FORM };
    setForm(nextForm);
    setFormErrors([]);
    setShowModal(true);
    persistNow({ form: nextForm, showModal: true, editingRuleId: null });
  };

  const openEdit = (rule) => {
    const nextForm = ruleToForm(rule);
    setEditingRule(rule);
    setForm(nextForm);
    setFormErrors([]);
    setShowModal(true);
    persistNow({ form: nextForm, showModal: true, editingRuleId: rule._id });
  };

  const handleSave = async () => {
    const errors = validateRuleForm(form);
    if (errors.length) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const payload = { ...formToPayload(form), meterId };
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
      clearMeterAlarmDraft(meterId);
      await fetchRules();
    } catch (err) {
      setFormErrors([err.response?.data?.message || 'Failed to save rule']);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId) => {
    if (!window.confirm('Delete this alarm rule?')) return;
    try {
      await axios.delete(`/api/energy-meter/alarms/rules/${ruleId}`, {
        withCredentials: true,
      });
      await fetchRules();
    } catch (err) {
      console.error('Delete rule failed', err);
    }
  };

  const handleToggle = async (rule) => {
    try {
      await axios.patch(
        `/api/energy-meter/alarms/rules/${rule._id}/toggle`,
        { enabled: !rule.enabled },
        { withCredentials: true }
      );
      await fetchRules();
    } catch (err) {
      console.error('Toggle rule failed', err);
    }
  };

  return (
    <Card className={styles.card}>
      <Card.Header className={styles.header}>
        <div className={styles.titleRow}>
          <Bell size={18} />
          <span>Alarm Settings</span>
        </div>
        <Button size="sm" variant="primary" onClick={openCreate}>
          <Plus size={14} className="me-1" />
          Add Rule
        </Button>
      </Card.Header>

      {showDraftBanner && (
        <div className={styles.draftBanner}>
          <span>You have an unsaved alarm rule draft.</span>
          <Button size="sm" variant="outline-primary" onClick={resumeDraft}>
            Continue editing
          </Button>
        </div>
      )}

      <Card.Body className="p-0">
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" />
          </div>
        ) : rules.length === 0 ? (
          <div className={styles.empty}>No alarm rules configured for this meter.</div>
        ) : (
          <div className={styles.tableWrap}>
            <Table size="sm" hover className="mb-0">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule._id}>
                    <td>
                      {getMetricLabel(rule.metric)}
                      {rule.metric === 'energyConsumption' && rule.consumptionPeriod && (
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
                        label={rule.enabled !== false ? 'On' : 'Off'}
                      />
                    </td>
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

      <Modal show={showModal} onHide={closeModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingRule ? 'Edit Alarm Rule' : 'Add Alarm Rule'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
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
    </Card>
  );
}
