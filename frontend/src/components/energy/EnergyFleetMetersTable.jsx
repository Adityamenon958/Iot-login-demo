import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Form, Spinner, Table } from 'react-bootstrap';
import axios from 'axios';
import EnergyChartRangePills from './EnergyChartRangePills';
import { formatMeterDisplayLabel, formatStatValue } from './energyChartShared';
import { HEALTH_COLORS } from './electricalHealthMetrics';
import {
  computeFooterStats,
  DEFAULT_SORT_KEY,
  ENABLE_FLEET_CSV_EXPORT,
  filterAndSortRows,
  FLEET_TABLE_RANGES,
  getStatusLabel,
  SORTABLE_COLUMNS,
  STATUS_BADGE_VARIANT,
  STATUS_FILTER_OPTIONS,
  TABLE_DENSITY_MODES,
  DEFAULT_DENSITY,
} from './fleetTableConfig';
import styles from './EnergyFleetMetersTable.module.css';
import attentionStyles from './energyAlarmAttention.module.css';

const ALARM_FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'critical', label: 'Critical' },
  { key: 'warning', label: 'Warning' },
];

function matchesAlarmFilter(row, alarmInfo, alarmFilter) {
  if (!alarmFilter || alarmFilter === 'all') return true;
  if (!alarmInfo?.count) return false;
  if (alarmFilter === 'active') return (alarmInfo.activeCount ?? 0) > 0;
  if (alarmFilter === 'acknowledged') {
    return (alarmInfo.acknowledgedCount ?? 0) > 0 && (alarmInfo.activeCount ?? 0) === 0;
  }
  if (alarmFilter === 'critical') return alarmInfo.highestSeverity === 'critical';
  if (alarmFilter === 'warning') {
    return alarmInfo.highestSeverity === 'warning' && alarmInfo.highestSeverity !== 'critical';
  }
  return true;
}

function getRowAlarmClass(alarmInfo) {
  if (!alarmInfo?.count) return '';
  if (alarmInfo.highestSeverity === 'critical') return attentionStyles.rowAlarmCritical;
  if (alarmInfo.highestSeverity === 'warning') return attentionStyles.rowAlarmWarning;
  return '';
}

function HealthIndicator({ status }) {
  const key = status || 'unknown';
  const dotClass = {
    healthy: styles.dotHealthy,
    warning: styles.dotWarning,
    critical: styles.dotCritical,
    unknown: styles.dotUnknown,
  }[key] || styles.dotUnknown;

  const label = key.charAt(0).toUpperCase() + key.slice(1);
  const badge = HEALTH_COLORS[key]?.badge || 'secondary';

  return (
    <span className={styles.indicator}>
      <span className={`${styles.dot} ${dotClass}`} aria-hidden="true" />
      <Badge bg={badge} className="text-capitalize">
        {label}
      </Badge>
    </span>
  );
}

function StatusBadge({ row }) {
  const state = row.communicationState || 'never_reported';
  const variant = STATUS_BADGE_VARIANT[state] || 'secondary';
  return <Badge bg={variant}>{getStatusLabel(row)}</Badge>;
}

function getRowHealthClass(healthStatus) {
  const map = {
    healthy: styles.rowHealthy,
    warning: styles.rowWarning,
    critical: styles.rowCritical,
    unknown: styles.rowUnknown,
  };
  return map[healthStatus] || styles.rowUnknown;
}

function formatReading(value, unit, decimals = 2) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return formatStatValue(value, unit, decimals);
}

export default function EnergyFleetMetersTable({
  refreshKey = 0,
  onSelectMeter,
  simDataHidden = false,
  alarmByMeter = {},
}) {
  const [range, setRange] = useState('24h');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [alarmFilter, setAlarmFilter] = useState('all');
  const [sortKey, setSortKey] = useState(DEFAULT_SORT_KEY);
  const [sortDirection, setSortDirection] = useState('asc');

  const fetchTable = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await axios.get('/api/energy-meter/fleet-table', {
        params: { range },
        withCredentials: true,
      });
      setData(res.data);
    } catch (err) {
      console.error('Fleet meters table fetch failed:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchTable(true);
    const interval = setInterval(() => fetchTable(false), 30000);
    return () => clearInterval(interval);
  }, [fetchTable, refreshKey]);

  const displayRows = useMemo(() => {
    const sorted = filterAndSortRows(data?.meters || [], {
      searchQuery,
      statusFilter,
      sortKey,
      sortDirection,
    });
    return sorted.filter((row) =>
      matchesAlarmFilter(row, alarmByMeter[row.meterId], alarmFilter)
    );
  }, [data?.meters, searchQuery, statusFilter, sortKey, sortDirection, alarmByMeter, alarmFilter]);

  const footerStats = useMemo(
    () => computeFooterStats(displayRows, range),
    [displayRows, range]
  );

  const handleSort = (columnKey) => {
    if (sortKey === columnKey) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(DEFAULT_SORT_KEY);
        setSortDirection('asc');
      }
      return;
    }
    setSortKey(columnKey);
    setSortDirection('asc');
  };

  const handleRowActivate = (meterId) => {
    if (typeof onSelectMeter === 'function') onSelectMeter(meterId);
  };

  const handleResetSort = () => {
    setSortKey(DEFAULT_SORT_KEY);
    setSortDirection('asc');
  };

  const densityClass = TABLE_DENSITY_MODES[DEFAULT_DENSITY];

  if (loading && !data) {
    return (
      <section className={styles.section}>
        <h6 className={styles.sectionTitle}>Fleet Meter Readings</h6>
        <div className={styles.loading}>
          <Spinner animation="border" size="sm" variant="primary" />
        </div>
      </section>
    );
  }

  if (!data?.meters?.length) {
    return (
      <section className={styles.section}>
        <h6 className={styles.sectionTitle}>Fleet Meter Readings</h6>
        <div className={styles.empty}>
          {simDataHidden
            ? 'No live meter data. Simulator data is hidden.'
            : 'No energy meters registered.'}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h6 className={styles.sectionTitle}>Fleet Meter Readings</h6>
        <EnergyChartRangePills ranges={FLEET_TABLE_RANGES} value={range} onChange={setRange} />
      </div>

      <div className={styles.toolbar}>
        <Form.Control
          type="search"
          size="sm"
          className={styles.searchInput}
          placeholder="Search meters…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search meters"
        />
        <Form.Select
          size="sm"
          className={styles.statusSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </Form.Select>
        <div className={styles.alarmFilterGroup} role="group" aria-label="Filter by alarm status">
          {ALARM_FILTER_OPTIONS.map((opt) => (
            <Button
              key={opt.key}
              size="sm"
              variant={alarmFilter === opt.key ? 'primary' : 'outline-secondary'}
              className={styles.alarmFilterBtn}
              onClick={() => setAlarmFilter(opt.key)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        {sortKey !== DEFAULT_SORT_KEY && (
          <Button
            variant="outline-secondary"
            size="sm"
            className={styles.resetSortBtn}
            onClick={handleResetSort}
          >
            Reset sort
          </Button>
        )}
        <Button
          variant="outline-secondary"
          size="sm"
          className={styles.exportBtn}
          disabled={!ENABLE_FLEET_CSV_EXPORT}
          title="Export CSV (coming soon)"
        >
          Export CSV
        </Button>
      </div>

      <div className={`${styles.tableWrap} ${styles[densityClass]}`}>
        <div className={styles.tableScroll}>
          <Table size="sm" hover responsive className={styles.table}>
            <thead>
              <tr>
                {SORTABLE_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`${styles.sortableTh} ${
                      sortKey === col.key ? styles.sortActive : ''
                    }`}
                    onClick={() => handleSort(col.key)}
                    scope="col"
                  >
                    {col.label}
                    {sortKey === col.key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
                <th scope="col">Alarms</th>
                <th scope="col">View Details</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={SORTABLE_COLUMNS.length + 2} className={styles.empty}>
                    No meters match filters.
                  </td>
                </tr>
              ) : (
                displayRows.map((row) => {
                  const alarmInfo = alarmByMeter[row.meterId];
                  return (
                  <tr
                    key={row.meterId}
                    className={[
                      styles.dataRow,
                      getRowHealthClass(row.healthStatus),
                      getRowAlarmClass(alarmInfo),
                    ].filter(Boolean).join(' ')}
                    onClick={() => handleRowActivate(row.meterId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowActivate(row.meterId);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open details for ${row.meterId}`}
                  >
                    <td className={styles.meterCell}>
                      {formatMeterDisplayLabel(row.meterId, row.machineName)}
                    </td>
                    <td>
                      <StatusBadge row={row} />
                    </td>
                    <td>{formatReading(row.readings?.activePowerKw, 'kW', 2)}</td>
                    <td>{formatReading(row.readings?.peakPowerKw, 'kW', 2)}</td>
                    <td>{formatReading(row.readings?.energyKwh, 'kWh', 2)}</td>
                    <td>{formatReading(row.readings?.voltage, 'V', 1)}</td>
                    <td>{formatReading(row.readings?.current, 'A', 2)}</td>
                    <td>{formatReading(row.readings?.powerFactor, '', 2)}</td>
                    <td>{formatReading(row.readings?.frequency, 'Hz', 2)}</td>
                    <td>
                      <HealthIndicator status={row.healthStatus} />
                    </td>
                    <td>{row.lastCommunication || '—'}</td>
                    <td>
                      {alarmInfo?.count > 0 ? (
                        <Badge bg={alarmInfo.highestSeverity === 'critical' ? 'danger' : 'warning'}>
                          {alarmInfo.count}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className={styles.detailsBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowActivate(row.meterId);
                        }}
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>

        <div className={styles.footer}>
          <span className={styles.footerStat}>
            Visible: <strong>{footerStats.totalMeters}</strong>
          </span>
          <span className={styles.footerStat}>
            Online: <strong>{footerStats.onlineMeters}</strong>
          </span>
          <span className={styles.footerStat}>
            Offline: <strong>{footerStats.offlineMeters}</strong>
          </span>
          <span className={styles.footerStat}>
            Total power:{' '}
            <strong>
              {footerStats.totalCurrentPower != null
                ? `${footerStats.totalCurrentPower.toFixed(2)} kW`
                : '—'}
            </strong>
          </span>
          <span className={styles.footerStat}>
            Total energy ({footerStats.rangeLabel}):{' '}
            <strong>
              {footerStats.totalEnergy != null
                ? `${footerStats.totalEnergy.toFixed(2)} kWh`
                : '—'}
            </strong>
          </span>
        </div>
      </div>
    </section>
  );
}
