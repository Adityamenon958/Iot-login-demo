import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Modal, Table, Button, Badge, Spinner, Form } from 'react-bootstrap';
import { ArrowLeft, History } from 'lucide-react';
import {
  getMetricLabel,
  formatValueWithUnit,
} from './energyAlarmConfig';
import styles from './EnergyFleetActiveAlarmsPanel.module.css';

const HISTORY_RANGES = [
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: '365d', label: 'Last 12 months', days: 365 },
];

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function statusBadge(status) {
  if (status === 'active') return <Badge bg="danger">active</Badge>;
  if (status === 'acknowledged') return <Badge bg="warning" text="dark">acknowledged</Badge>;
  if (status === 'cleared') return <Badge bg="secondary">cleared</Badge>;
  return <Badge bg="light" text="dark">{status}</Badge>;
}

export default function EnergyFleetActiveAlarmsPanel({
  show,
  onHide,
  refreshKey = 0,
  onChanged,
  onSelectMeter,
}) {
  const [view, setView] = useState('last24h');
  const [historyRange, setHistoryRange] = useState('30d');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [ackTarget, setAckTarget] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const limit = view === 'last24h' ? 100 : 20;

  const rangeConfig = useMemo(
    () => HISTORY_RANGES.find((r) => r.key === historyRange) || HISTORY_RANGES[0],
    [historyRange]
  );

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit };
      if (view === 'last24h') {
        params.from = daysAgoIso(1);
      } else {
        params.from = daysAgoIso(rangeConfig.days);
      }
      const res = await axios.get('/api/energy-meter/alarms/events', {
        params,
        withCredentials: true,
      });
      setEvents(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load fleet alarms', err);
      setEvents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [view, page, limit, rangeConfig.days]);

  useEffect(() => {
    if (!show) return;
    fetchEvents();
  }, [show, fetchEvents, refreshKey]);

  useEffect(() => {
    if (!show) {
      setView('last24h');
      setPage(1);
      setHistoryRange('30d');
    }
  }, [show]);

  useEffect(() => {
    setPage(1);
  }, [view, historyRange]);

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
      await fetchEvents();
      onChanged?.();
    } catch (err) {
      console.error('Acknowledge failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  const openCount = events.filter((e) => e.status === 'active' || e.status === 'acknowledged').length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const title = view === 'last24h' ? 'Alarms — Last 24 Hours' : `All Alarms — ${rangeConfig.label}`;

  const handleOpenMeter = (ev) => {
    if (!ev?.meterId || !onSelectMeter) return;
    onSelectMeter(ev.meterId);
    onHide?.();
  };

  return (
    <>
      <Modal show={show} onHide={onHide} size="xl" centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body className={styles.body}>
          {view === 'history' && (
            <div className={styles.toolbar}>
              <Button
                variant="link"
                className={styles.backBtn}
                onClick={() => setView('last24h')}
              >
                <ArrowLeft size={16} className="me-1" />
                Back to last 24 hours
              </Button>
              <Form.Select
                size="sm"
                className={styles.rangeSelect}
                value={historyRange}
                onChange={(e) => setHistoryRange(e.target.value)}
              >
                {HISTORY_RANGES.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </Form.Select>
            </div>
          )}

          {view === 'last24h' && !loading && events.length > 0 && (
            <p className={styles.summaryLine}>
              <strong>{events.length}</strong> alarm{events.length !== 1 ? 's' : ''} triggered in the last 24 hours
              {openCount > 0 && (
                <span className="text-muted"> · {openCount} still open</span>
              )}
            </p>
          )}

          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center text-muted py-4">
              {view === 'last24h'
                ? 'No alarms triggered in the last 24 hours.'
                : `No alarms found for ${rangeConfig.label.toLowerCase()}.`}
            </div>
          ) : (
            <Table size="sm" hover responsive className={`mb-0 ${styles.table}`}>
              <thead>
                <tr>
                  <th>Meter</th>
                  <th>Metric</th>
                  <th>Condition</th>
                  <th>Actual</th>
                  <th>Threshold</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Triggered</th>
                  {view === 'history' && <th>Cleared</th>}
                  <th />
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const isClickable = Boolean(onSelectMeter && ev.meterId);
                  return (
                  <tr
                    key={ev._id}
                    className={[
                      ev.status === 'active' ? styles.rowActive : '',
                      isClickable ? styles.rowClickable : '',
                    ].filter(Boolean).join(' ')}
                    onClick={isClickable ? () => handleOpenMeter(ev) : undefined}
                    title={isClickable ? 'Open meter page' : undefined}
                  >
                    <td>{ev.meterName || ev.meterId}</td>
                    <td>{getMetricLabel(ev.metric)}</td>
                    <td className={styles.conditionCell}>{ev.conditionLabel}</td>
                    <td>{formatValueWithUnit(ev.actualValue, ev.metric)}</td>
                    <td>{formatValueWithUnit(ev.threshold, ev.metric)}</td>
                    <td>
                      <Badge bg={ev.severity === 'critical' ? 'danger' : 'warning'}>
                        {ev.severity}
                      </Badge>
                    </td>
                    <td>{statusBadge(ev.status)}</td>
                    <td className={styles.timeCell}>{formatTime(ev.triggeredAt)}</td>
                    {view === 'history' && (
                      <td className={styles.timeCell}>{formatTime(ev.clearedAt)}</td>
                    )}
                    <td>
                      {ev.status === 'active' && (
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAckTarget(ev);
                          }}
                        >
                          Ack
                        </Button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          {view === 'history' && totalPages > 1 && (
            <div className={styles.pager}>
              <Button size="sm" variant="outline-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <span>Page {page} of {totalPages} ({total} total)</span>
              <Button size="sm" variant="outline-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </Modal.Body>
        {view === 'last24h' && (
          <Modal.Footer className={styles.footer}>
            <Button variant="outline-secondary" onClick={() => setView('history')}>
              <History size={16} className="me-2" />
              View all previous alarms
            </Button>
            <Button variant="secondary" onClick={onHide}>Close</Button>
          </Modal.Footer>
        )}
        {view === 'history' && (
          <Modal.Footer>
            <Button variant="secondary" onClick={onHide}>Close</Button>
          </Modal.Footer>
        )}
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
