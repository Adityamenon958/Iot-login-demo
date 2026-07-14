import React, { useEffect, useRef, useState } from 'react';
import styles from './LiveDataTable.module.css';

/**
 * ✅ Normalize quality for badge display — empty means not provided (show —)
 */
export function normalizeQualityLabel(quality) {
  const raw = quality == null ? '' : String(quality).trim();
  if (!raw) {
    return null;
  }
  const q = raw.toLowerCase();
  if (q === 'good' || q === 'ok' || q === 'valid') {
    return { label: 'Good', tone: 'good' };
  }
  if (q === 'warning' || q === 'warn' || q === 'uncertain' || q === 'stale') {
    return { label: 'Warning', tone: 'warning' };
  }
  if (q === 'bad' || q === 'error' || q === 'invalid' || q === 'fault') {
    return { label: 'Bad', tone: 'bad' };
  }
  return { label: raw, tone: 'neutral' };
}

function formatLocalTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function formatCellValue(value) {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * ✅ Demo live JSON table — rows flash ~1s when first seen
 */
export default function LiveDataTable({ rows, autoScroll }) {
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [flashingIds, setFlashingIds] = useState(() => new Set());
  const seenIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);
  const tableTopRef = useRef(null);

  useEffect(() => {
    if (!rows || rows.length === 0) return;

    const seen = seenIdsRef.current;
    const brandNew = [];

    for (const row of rows) {
      if (!seen.has(row.id)) {
        brandNew.push(row.id);
        seen.add(row.id);
      }
    }

    // ✅ Don't flash the entire first payload load
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      return;
    }

    if (brandNew.length === 0) return;

    setFlashingIds((prev) => {
      const next = new Set(prev);
      brandNew.forEach((id) => next.add(id));
      return next;
    });

    const timer = setTimeout(() => {
      setFlashingIds((prev) => {
        const next = new Set(prev);
        brandNew.forEach((id) => next.delete(id));
        return next;
      });
    }, 1000);

    if (autoScroll && tableTopRef.current) {
      tableTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    return () => clearTimeout(timer);
  }, [rows, autoScroll]);

  if (!rows || rows.length === 0) {
    return (
      <div className={styles.empty} ref={tableTopRef}>
        Waiting for live data…
      </div>
    );
  }

  return (
    <div className={styles.wrap} ref={tableTopRef}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th aria-label="Expand" />
              <th>Timestamp</th>
              <th>Device</th>
              <th>Field</th>
              <th>Address</th>
              <th>Value</th>
              <th>Unit</th>
              <th>Latency</th>
              <th>Quality</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const quality = normalizeQualityLabel(row.quality);
              const isFlash = flashingIds.has(row.id);
              const isExpanded = expandedRowId === row.id;
              const fieldLabel = row.fieldPath || row.registerName || '—';
              const deviceLabel = row.deviceName || row.deviceId || '—';

              return (
                <React.Fragment key={row.id}>
                  <tr className={isFlash ? styles.rowFlash : undefined}>
                    <td>
                      <button
                        type="button"
                        className={styles.expandBtn}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? 'Hide raw JSON' : 'Show raw JSON'}
                        onClick={() =>
                          setExpandedRowId((prev) => (prev === row.id ? null : row.id))
                        }
                      >
                        {isExpanded ? '▾' : '▸'}
                      </button>
                    </td>
                    <td>
                      <div>{formatLocalTime(row.receivedAt)}</div>
                      {row.sourceTs ? (
                        <div className={styles.secondaryTs}>
                          src {formatLocalTime(row.sourceTs)}
                        </div>
                      ) : null}
                    </td>
                    <td>{deviceLabel}</td>
                    <td className={styles.mono}>{fieldLabel}</td>
                    <td className={styles.mono}>{row.registerAddress || '—'}</td>
                    <td className={`${styles.mono} ${styles.value}`}>
                      {formatCellValue(row.value)}
                    </td>
                    <td>{row.unit || '—'}</td>
                    <td className={styles.mono}>
                      {row.latencyMs == null ? '—' : `${row.latencyMs} ms`}
                    </td>
                    <td>
                      {quality ? (
                        <span className={`${styles.badge} ${styles[quality.tone]}`}>
                          {quality.label}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                  {isExpanded && row.raw ? (
                    <tr className={styles.jsonRow}>
                      <td colSpan={9}>
                        <pre className={styles.jsonPre}>
                          {JSON.stringify(row.raw, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
