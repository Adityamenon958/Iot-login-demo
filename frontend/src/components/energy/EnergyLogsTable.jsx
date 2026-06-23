import React from 'react';
import { Table, Badge, Card } from 'react-bootstrap';
import styles from './EnergyLogsTable.module.css';

export default function EnergyLogsTable({ logs = [], selectedLogId, onSelectLog }) {
  return (
    <Card className={styles.tableCard}>
      <Card.Body>
        <h6 className={styles.title}>Reading History</h6>
        <div className={styles.tableScroll}>
          <Table hover size="sm" className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Raw Values</th>
                <th>Readings</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-3">
                    No logs yet
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const id = log._id;
                  const isSelected = selectedLogId === id;
                  return (
                    <tr
                      key={id}
                      className={isSelected ? styles.selectedRow : ''}
                      onClick={() => onSelectLog?.(log)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{new Date(log.timestamp).toLocaleString()}</td>
                      <td>
                        <code className={styles.code}>
                          {Array.isArray(log.rawValues)
                            ? JSON.stringify(log.rawValues)
                            : '—'}
                        </code>
                      </td>
                      <td>
                        <code className={styles.code}>
                          {log.readings && Object.keys(log.readings).length
                            ? JSON.stringify(log.readings)
                            : '—'}
                        </code>
                      </td>
                      <td>
                        <Badge
                          bg={
                            log.parseStatus === 'parsed'
                              ? 'success'
                              : log.parseStatus === 'partial'
                                ? 'warning'
                                : 'secondary'
                          }
                        >
                          {log.parseStatus}
                        </Badge>
                      </td>
                      <td>{isSelected ? '●' : ''}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>
      </Card.Body>
    </Card>
  );
}
