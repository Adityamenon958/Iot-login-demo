import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Card, Table, Button, Badge, Spinner, Modal, Form } from 'react-bootstrap';
import { AlertTriangle } from 'lucide-react';
import {
  getMetricLabel,
  formatValueWithUnit,
} from './energyAlarmConfig';
import styles from './EnergyMeterActiveAlarms.module.css';

export default function EnergyMeterActiveAlarms({ meterId, refreshKey = 0, onChanged }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ackTarget, setAckTarget] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchActive = useCallback(async () => {
    if (!meterId) return;
    try {
      setLoading(true);
      const res = await axios.get('/api/energy-meter/alarms/events/active', {
        params: { meterId },
        withCredentials: true,
      });
      setEvents(res.data.data || []);
    } catch (err) {
      console.error('Failed to load active alarms', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [meterId]);

  useEffect(() => {
    fetchActive();
  }, [fetchActive, refreshKey]);

  const handleAcknowledge = async () => {
    if (!ackTarget) return;
    setSubmitting(true);
    try {
      await axios.patch(
        `/api/energy-meter/alarms/events/${ackTarget._id}/acknowledge`,
        { comment },
        { withCredentials: true }
      );
      setAckTarget(null);
      setComment('');
      await fetchActive();
      onChanged?.();
    } catch (err) {
      console.error('Acknowledge failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className={styles.card}>
        <Card.Body className="text-center py-3">
          <Spinner animation="border" size="sm" />
        </Card.Body>
      </Card>
    );
  }

  if (!events.length) return null;

  return (
    <>
      <Card className={`${styles.card} ${styles.hasAlarms}`}>
        <Card.Header className={styles.header}>
          <div className={styles.titleRow}>
            <AlertTriangle size={18} />
            <span>Active Alarms</span>
            <Badge bg="danger">{events.length}</Badge>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          <div className={styles.tableWrap}>
            <Table size="sm" hover className="mb-0">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Condition</th>
                  <th>Actual</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev._id}>
                    <td>{getMetricLabel(ev.metric)}</td>
                    <td>{ev.conditionLabel}</td>
                    <td>{formatValueWithUnit(ev.actualValue, ev.metric)}</td>
                    <td>
                      <Badge bg={ev.severity === 'critical' ? 'danger' : 'warning'}>
                        {ev.severity}
                      </Badge>
                    </td>
                    <td>{ev.status}</td>
                    <td>
                      {ev.status === 'active' && (
                        <Button size="sm" variant="outline-primary" onClick={() => setAckTarget(ev)}>
                          Acknowledge
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      <Modal show={Boolean(ackTarget)} onHide={() => setAckTarget(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Acknowledge Alarm</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted mb-2">{ackTarget?.message}</p>
          <Form.Group>
            <Form.Label>Comment (optional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={2}
              placeholder="e.g. Maintenance informed"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setAckTarget(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAcknowledge} disabled={submitting}>
            {submitting ? 'Saving…' : 'Acknowledge'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
