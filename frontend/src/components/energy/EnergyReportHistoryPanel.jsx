import React, { useCallback, useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { fetchReportHistory } from '../../services/energyReportApi';
import styles from './EnergyReportHistoryPanel.module.css';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function EnergyReportHistoryPanel({ refreshKey = 0 }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReportHistory(10);
      setHistory(data);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loading) {
    return (
      <div className={styles.wrap}>
        <div className={styles.title}>Recent Reports</div>
        <div className="text-center py-2"><Spinner size="sm" /></div>
      </div>
    );
  }

  if (!history.length) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.title}>Recent Reports</div>
      <p className={styles.hint}>Metadata only — re-download available in a future update.</p>
      <ul className={styles.list}>
        {history.map((row) => (
          <li key={row.reportId} className={styles.item}>
            <span className={styles.period}>{row.periodLabel || row.periodPreset}</span>
            <span className={styles.meta}>
              {formatDate(row.createdAt)}
              {row.energyHealthScore != null && (
                <> · Health {row.energyHealthScore}/100</>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
