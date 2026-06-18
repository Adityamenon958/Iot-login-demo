import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Row, Col } from 'react-bootstrap';
import axios from 'axios';
import { getMetricDefinition } from './electricalHealthMetrics';
import { CHART_RANGES, METER_SEARCH_THRESHOLD, buildChartSubtitle } from './energyChartShared';
import EnergyChartRangePills from './EnergyChartRangePills';
import EnergyMultiLineChart from './EnergyMultiLineChart';
import EnergyChartLegendToggles from './EnergyChartLegendToggles';
import EnergyMeterSearch from './EnergyMeterSearch';
import EnergyMetricStatsTable from './EnergyMetricStatsTable';
import styles from './EnergyMetricDetailModal.module.css';

export default function EnergyMetricDetailModal({ show, metricKey, onHide, refreshKey = 0 }) {
  const metricDef = getMetricDefinition(metricKey);
  const [range, setRange] = useState('24h');
  const [chartMeta, setChartMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [visibleMeters, setVisibleMeters] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const fetchHistory = useCallback(async () => {
    if (!metricKey) return;
    setLoading(true);
    try {
      const res = await axios.get('/api/energy-meter/metric-history', {
        params: { metric: metricKey, range },
        withCredentials: true,
      });
      setChartMeta(res.data);
      const ids = (res.data.chartSeries || []).map((s) => s.meterId);
      setVisibleMeters(new Set(ids));
    } catch (err) {
      console.error('Metric history fetch failed:', err);
      setChartMeta(null);
    } finally {
      setLoading(false);
    }
  }, [metricKey, range]);

  useEffect(() => {
    if (show && metricKey) {
      setSearchQuery('');
      fetchHistory();
    }
  }, [show, metricKey, fetchHistory, refreshKey]);

  const chartSeries = chartMeta?.chartSeries || [];
  const showSearch = chartSeries.length > METER_SEARCH_THRESHOLD;

  const filteredVisibleMeters = useMemo(() => {
    if (!searchQuery.trim()) return visibleMeters;
    const q = searchQuery.trim().toLowerCase();
    const matching = new Set();
    chartSeries.forEach((s) => {
      const hay = [s.meterId, s.machineName, s.siteName].filter(Boolean).join(' ').toLowerCase();
      if (hay.includes(q) && visibleMeters.has(s.meterId)) {
        matching.add(s.meterId);
      }
    });
    return matching;
  }, [chartSeries, visibleMeters, searchQuery]);

  const handleToggle = (meterId) => {
    setVisibleMeters((prev) => {
      const next = new Set(prev);
      if (next.has(meterId)) next.delete(meterId);
      else next.add(meterId);
      return next;
    });
  };

  if (!metricDef) return null;

  const subtitle = buildChartSubtitle(chartMeta);
  const statsColumns = chartMeta?.statsColumns || metricDef.statsColumns;
  const statsLabels = chartMeta?.statsLabels || metricDef.statsLabels || {};

  return (
    <Modal show={show} onHide={onHide} size="xl" fullscreen="md-down" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {metricDef.label}
          {metricDef.unit ? ` (${metricDef.unit})` : ''}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.body}>
        <div className={styles.toolbar}>
          <EnergyChartRangePills ranges={CHART_RANGES} value={range} onChange={setRange} />
        </div>

        <EnergyMultiLineChart
          chartSeries={chartSeries}
          visibleMeters={searchQuery.trim() ? filteredVisibleMeters : visibleMeters}
          range={range}
          unit={metricDef.unit}
          height={320}
          referenceLines={chartMeta?.referenceLines || metricDef.referenceLines}
          loading={loading}
        />

        {subtitle && <div className={styles.subtitle}>{subtitle}</div>}

        {showSearch && (
          <EnergyMeterSearch value={searchQuery} onChange={setSearchQuery} />
        )}

        <EnergyChartLegendToggles
          chartSeries={chartSeries}
          visibleMeters={visibleMeters}
          onToggle={handleToggle}
          searchQuery={searchQuery}
        />

        <Row className="mt-3">
          <Col xs={12}>
            <h6 className={styles.statsTitle}>Per-meter statistics</h6>
            <EnergyMetricStatsTable
              chartSeries={chartSeries}
              statsColumns={statsColumns}
              statsLabels={statsLabels}
              unit={metricDef.unit}
              decimals={metricDef.decimals}
              searchQuery={searchQuery}
            />
          </Col>
        </Row>
      </Modal.Body>
    </Modal>
  );
}
