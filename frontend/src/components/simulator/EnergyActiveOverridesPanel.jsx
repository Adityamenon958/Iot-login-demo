import React, { useCallback, useEffect, useState } from 'react';
import { Card, Table, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import { RefreshCw, RotateCcw } from 'lucide-react';
import axios from 'axios';
import styles from './EnergyActiveOverridesPanel.module.css';

function formatRemaining(ms) {
  if (ms == null) return 'No limit';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function EnergyActiveOverridesPanel({ refreshKey = 0, onRestore }) {
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState('');

  const fetchOverrides = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get('/api/sim/energy-active-overrides', { withCredentials: true });
      setOverrides(res.data.overrides || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load active overrides');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides, refreshKey]);

  useEffect(() => {
    if (!overrides.length) return undefined;
    const timer = setInterval(() => {
      setOverrides((prev) =>
        prev.map((o) => ({
          ...o,
          remainingMs: o.remainingMs != null ? Math.max(0, o.remainingMs - 1000) : null,
        })).filter((o) => o.remainingMs == null || o.remainingMs > 0)
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [overrides.length]);

  const handleRestore = async (deviceId) => {
    setRestoring(deviceId);
    try {
      await axios.post('/api/sim/energy-reading-override/restore', { DeviceID: deviceId }, {
        withCredentials: true,
      });
      onRestore?.();
      fetchOverrides();
    } catch (err) {
      setError(err.response?.data?.error || 'Restore failed');
    } finally {
      setRestoring('');
    }
  };

  const handleRestoreAll = async () => {
    setRestoring('all');
    try {
      await axios.post('/api/sim/energy-reading-override/restore-all', {}, { withCredentials: true });
      onRestore?.();
      fetchOverrides();
    } catch (err) {
      setError(err.response?.data?.error || 'Restore all failed');
    } finally {
      setRestoring('');
    }
  };

  if (!loading && overrides.length === 0) return null;

  return (
    <Card className={`mb-4 ${styles.panel}`}>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Active Alarm Overrides</h5>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" size="sm" onClick={fetchOverrides} disabled={loading}>
            <RefreshCw size={14} className="me-1" />
            Refresh
          </Button>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={handleRestoreAll}
            disabled={restoring === 'all' || !overrides.length}
          >
            {restoring === 'all' ? <Spinner size="sm" /> : <><RotateCcw size={14} className="me-1" />Restore All</>}
          </Button>
        </div>
      </Card.Header>
      <Card.Body>
        {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
        {loading ? (
          <div className="text-center py-3"><Spinner animation="border" size="sm" /></div>
        ) : (
          <Table responsive size="sm" striped className="mb-0">
            <thead>
              <tr>
                <th>Meter</th>
                <th>Forced readings</th>
                <th>Mode</th>
                <th>Started</th>
                <th>Remaining</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {overrides.map((o) => (
                <tr key={o.deviceId}>
                  <td><strong>{o.deviceId}</strong></td>
                  <td><small>{o.readingsSummary || '—'}</small></td>
                  <td><Badge bg="info">{o.breachMode || 'standard'}</Badge></td>
                  <td><small>{o.startedAt ? new Date(o.startedAt).toLocaleTimeString() : '—'}</small></td>
                  <td><strong className={styles.countdown}>{formatRemaining(o.remainingMs)}</strong></td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      disabled={restoring === o.deviceId}
                      onClick={() => handleRestore(o.deviceId)}
                    >
                      {restoring === o.deviceId ? <Spinner size="sm" /> : 'Restore'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card.Body>
    </Card>
  );
}
