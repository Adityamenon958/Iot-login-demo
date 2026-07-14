import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import DeviceInfoCard from '../../components/demo/DeviceInfoCard';
import LiveDataTable from '../../components/demo/LiveDataTable';
import styles from './LiveDataDemo.module.css';

const POLL_MS = 1000;
const SESSION_KEY = 'demoApiKey';

const emptyStats = {
  totalPostRequests: 0,
  totalRegisterUpdates: 0,
  lastRegisterUpdated: null,
  lastReceivedAt: null,
  bufferSize: 0,
  bufferCapacity: 100,
  messagesPerSec: 0,
  connected: false,
};

const emptyDevice = {
  deviceId: null,
  deviceName: null,
  communication: null,
  source: null,
};

function formatLocalTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function connectionFromStats(stats) {
  if (stats?.connected) {
    return { label: 'Connected', tone: 'connected' };
  }
  if (stats?.lastReceivedAt) {
    return { label: 'Stale', tone: 'stale' };
  }
  return { label: 'Waiting', tone: 'waiting' };
}

/**
 * ✅ Temporary public demo page — /demo/live-data
 * ❗ Easy to remove: delete this folder + App.jsx route after demo
 */
export default function LiveDataDemo() {
  const [rows, setRows] = useState([]);
  const [device, setDevice] = useState(emptyDevice);
  const [stats, setStats] = useState(emptyStats);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [error, setError] = useState(null);
  const [lastFetchOk, setLastFetchOk] = useState(true);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const fetchLiveData = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    if (pausedRef.current) return;

    try {
      const { data } = await axios.get('/api/demo/live-data');
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setDevice(data.device || emptyDevice);
      setStats(data.stats || emptyStats);
      setError(null);
      setLastFetchOk(true);
    } catch (err) {
      setLastFetchOk(false);
      setError(err?.response?.data?.error || err.message || 'Failed to fetch live data');
    }
  }, []);

  useEffect(() => {
    fetchLiveData();
    const id = setInterval(fetchLiveData, POLL_MS);
    return () => clearInterval(id);
  }, [fetchLiveData]);

  const filteredRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const field = String(row.fieldPath || row.registerName || '').toLowerCase();
      const deviceName = String(row.deviceName || '').toLowerCase();
      const deviceId = String(row.deviceId || '').toLowerCase();
      const value = String(row.value ?? '').toLowerCase();
      return (
        field.includes(q) ||
        deviceName.includes(q) ||
        deviceId.includes(q) ||
        value.includes(q)
      );
    });
  }, [rows, filterText]);

  const connection = connectionFromStats(stats);

  const handleClear = async () => {
    let key = sessionStorage.getItem(SESSION_KEY);
    if (!key) {
      key = window.prompt('Enter DEMO_API_KEY to clear the table:');
      if (!key) return;
      sessionStorage.setItem(SESSION_KEY, key);
    }

    try {
      await axios.post(
        '/api/demo/live-data/clear',
        {},
        { headers: { 'x-demo-api-key': key } }
      );
      setRows([]);
      setDevice(emptyDevice);
      setStats(emptyStats);
      setError(null);
    } catch (err) {
      if (err?.response?.status === 401) {
        sessionStorage.removeItem(SESSION_KEY);
      }
      setError(err?.response?.data?.error || err.message || 'Clear failed');
    }
  };

  const handleCopyLatest = async () => {
    if (!rows.length) {
      setError('No payload to copy yet');
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(rows[0].raw, null, 2));
    } catch {
      setError('Clipboard copy failed');
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.brandRow}>
            <h1 className={styles.title}>GSN Edge — Live Device Data Monitor</h1>
            <span className={styles.tempBadge}>Temporary demo — not production</span>
          </div>
          <p className={styles.subtitle}>
            Universal live JSON monitor from the desktop bridge (in-memory only).
          </p>
        </div>
        {!lastFetchOk ? (
          <span className={styles.pollError}>Poll error</span>
        ) : null}
      </header>

      <DeviceInfoCard
        device={device}
        connectionLabel={connection.label}
        connectionTone={connection.tone}
      />

      <section className={styles.statsStrip} aria-label="Live statistics">
        <div className={styles.stat}>
          <span className={styles.statLabel}>Total POST Requests</span>
          <span className={styles.statValue}>{stats.totalPostRequests}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Total Field Updates</span>
          <span className={styles.statValue}>{stats.totalRegisterUpdates}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Last Field Updated</span>
          <span className={styles.statValue}>{stats.lastRegisterUpdated || '—'}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Last Received Timestamp</span>
          <span className={styles.statValue}>{formatLocalTime(stats.lastReceivedAt)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Buffer Usage</span>
          <span className={styles.statValue}>
            {stats.bufferSize} / {stats.bufferCapacity}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Messages/sec</span>
          <span className={styles.statValue}>{stats.messagesPerSec}</span>
        </div>
      </section>

      <section className={styles.controls}>
        <div className={styles.controlGroup}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
          <button type="button" className={styles.btn} onClick={handleClear}>
            Clear table
          </button>
          <button type="button" className={styles.btn} onClick={handleCopyLatest}>
            Copy latest payload
          </button>
        </div>
        <label className={styles.filter}>
          <span className={styles.filterLabel}>Filter</span>
          <input
            type="search"
            placeholder="Field path, device, or value…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </label>
      </section>

      {error ? <div className={styles.errorBanner}>{error}</div> : null}

      <LiveDataTable rows={filteredRows} autoScroll={autoScroll && !paused} />
    </div>
  );
}
