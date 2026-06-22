import React from 'react';
import { Table } from 'react-bootstrap';
import { formatMeterDisplayLabel } from './energyChartShared';
import styles from './EnergyFleetMeterRanking.module.css';

export default function EnergyFleetMeterRanking({
  title,
  rows = [],
  valueLabel = 'Value',
  unit = '',
}) {
  if (!rows.length) return null;

  return (
    <div className={styles.wrap}>
      <h6 className={styles.title}>{title}</h6>
      <Table size="sm" responsive className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Meter</th>
            <th>Site</th>
            <th className={styles.valueCol}>{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.meterId}-${row.rank}`}>
              <td>{row.rank}</td>
              <td>{formatMeterDisplayLabel(row.meterId, row.machineName)}</td>
              <td className={styles.muted}>{row.siteName || '—'}</td>
              <td className={styles.valueCol}>
                {row.value != null
                  ? Number(row.value).toFixed(row.decimals ?? 2)
                  : '—'}
                {unit ? ` ${unit}` : row.unit ? ` ${row.unit}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
