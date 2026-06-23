import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Card, Table, Badge, Spinner, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { History } from 'lucide-react';
import {
  getMetricLabel,
  formatValueWithUnit,
} from './energyAlarmConfig';
import styles from './EnergyMeterAlarmHistory.module.css';

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export default function EnergyMeterAlarmHistory({ meterId, refreshKey = 0, fleetMode = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 15;

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit };
      if (meterId && !fleetMode) params.meterId = meterId;
      const res = await axios.get('/api/energy-meter/alarms/events', {
        params,
        withCredentials: true,
      });
      setRows(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load alarm history', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [meterId, fleetMode, page]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <Card className={styles.card}>
      <Card.Header className={styles.header}>
        <div className={styles.titleRow}>
          <History size={18} />
          <span>Alarm History</span>
        </div>
      </Card.Header>
      <Card.Body className="p-0">
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" />
          </div>
        ) : rows.length === 0 ? (
          <div className={styles.empty}>No alarm events recorded yet.</div>
        ) : (
          <div className={styles.tableWrap}>
            <Table size="sm" striped hover className="mb-0">
              <thead>
                <tr>
                  {fleetMode && <th>Meter</th>}
                  <th>Metric</th>
                  <th>Condition</th>
                  <th>Actual</th>
                  <th>Threshold</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Triggered</th>
                  <th>Acknowledged By</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((ev) => (
                  <tr key={ev._id}>
                    {fleetMode && <td>{ev.meterName || ev.meterId}</td>}
                    <td>{getMetricLabel(ev.metric)}</td>
                    <td>{ev.conditionLabel}</td>
                    <td>{formatValueWithUnit(ev.actualValue, ev.metric)}</td>
                    <td>{formatValueWithUnit(ev.threshold, ev.metric)}</td>
                    <td>
                      <Badge bg={ev.severity === 'critical' ? 'danger' : 'warning'}>
                        {ev.severity}
                      </Badge>
                    </td>
                    <td>{ev.status}</td>
                    <td>{formatTime(ev.triggeredAt)}</td>
                    <td>
                      {ev.acknowledgedBy ? (
                        <OverlayTrigger
                          placement="top"
                          overlay={
                            <Tooltip>
                              {ev.acknowledgeComment || 'No comment'}
                            </Tooltip>
                          }
                        >
                          <span className={styles.ackCell}>{ev.acknowledgedBy}</span>
                        </OverlayTrigger>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
        {totalPages > 1 && (
          <div className={styles.pager}>
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
