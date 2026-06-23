import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Modal, Table, Button, Badge, Spinner, Form } from 'react-bootstrap';
import {
  getMetricLabel,
  formatValueWithUnit,
} from './energyAlarmConfig';
import styles from './EnergyFleetActiveAlarmsPanel.module.css';

export default function EnergyFleetActiveAlarmsPanel({ show, onHide, refreshKey = 0, onChanged }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ackTarget, setAckTarget] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchActive = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/energy-meter/alarms/events/active', {
        withCredentials: true,
      });
      setEvents(res.data.data || []);
    } catch (err) {
      console.error('Failed to load fleet active alarms', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (show) fetchActive();
  }, [show, fetchActive, refreshKey]);

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

  return (
    <>
      <Modal show={show} onHide={onHide} size="lg" centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title>Active Alarms — Fleet</Modal.Title>
        </Modal.Header>
        <Modal.Body className={styles.body}>
          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center text-muted py-4">No open alarms.</div>
          ) : (
            <Table size="sm" hover responsive className="mb-0">
              <thead>
                <tr>
                  <th>Meter</th>
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
                    <td>{ev.meterName || ev.meterId}</td>
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
                          Ack
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
      </Modal>

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
