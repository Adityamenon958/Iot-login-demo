import React, { useMemo } from 'react';
import { Badge, Table } from 'react-bootstrap';
import { formatStatValue } from './energyChartShared';
import styles from './EnergyMetricStatsTable.module.css';

const STATUS_RANK = { critical: 0, warning: 1, healthy: 2, unknown: 3 };

const COLUMN_LABELS = {
  current: 'Current',
  min: 'Min',
  max: 'Max',
  average: 'Avg',
  variation: 'Variation',
  currentPower: 'Current',
  peakPower: 'Peak',
  averagePower: 'Average',
  energyInRange: 'Energy',
  loadFactor: 'Load Factor',
  status: 'Status',
};

function StatusBadge({ status }) {
  const map = {
    healthy: 'success',
    warning: 'warning',
    critical: 'danger',
    unknown: 'secondary',
  };
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  return <Badge bg={map[status] || 'secondary'}>{label}</Badge>;
}

function getCellValue(stats, col, unit, decimals) {
  if (col === 'status') return null;
  if (col === 'loadFactor') return formatStatValue(stats?.loadFactor, '', decimals, true);
  if (col === 'energyInRange') return formatStatValue(stats?.energyInRange, 'kWh', 2);
  if (col === 'currentPower') return formatStatValue(stats?.currentPower, unit, decimals);
  if (col === 'peakPower') return formatStatValue(stats?.peakPower, unit, decimals);
  if (col === 'averagePower') return formatStatValue(stats?.averagePower, unit, decimals);
  return formatStatValue(stats?.[col], unit, decimals);
}

export default function EnergyMetricStatsTable({
  chartSeries = [],
  statsColumns = [],
  statsLabels = {},
  unit = '',
  decimals = 2,
  searchQuery = '',
}) {
  const q = searchQuery.trim().toLowerCase();

  const rows = useMemo(() => {
    const filtered = chartSeries.filter((s) => {
      if (!q) return true;
      const hay = [s.meterId, s.machineName, s.siteName].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });

    return [...filtered].sort((a, b) => {
      const ra = STATUS_RANK[a.status] ?? 3;
      const rb = STATUS_RANK[b.status] ?? 3;
      return ra - rb;
    });
  }, [chartSeries, q]);

  const dataCols = statsColumns.filter((c) => c !== 'status');

  if (!rows.length) {
    return <div className={styles.empty}>No meter statistics</div>;
  }

  return (
    <div className={styles.tableWrap}>
      <Table size="sm" hover responsive className={styles.table}>
        <thead>
          <tr>
            <th>Meter</th>
            {dataCols.map((col) => (
              <th key={col}>{statsLabels[col] || COLUMN_LABELS[col] || col}</th>
            ))}
            {statsColumns.includes('status') && <th>Status</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.meterId}>
              <td className={styles.meterCell}>
                <div className={styles.meterId}>{row.meterId}</div>
                {row.machineName && (
                  <div className={styles.meterSub}>{row.machineName}</div>
                )}
              </td>
              {dataCols.map((col) => (
                <td key={col}>{getCellValue(row.statistics, col, unit, decimals)}</td>
              ))}
              {statsColumns.includes('status') && (
                <td>
                  <StatusBadge status={row.status} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
