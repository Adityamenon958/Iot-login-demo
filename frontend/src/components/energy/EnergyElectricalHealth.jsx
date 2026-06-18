import React, { useCallback, useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import axios from 'axios';
import {
  ELECTRICAL_HEALTH_METRICS,
} from './electricalHealthMetrics';
import EnergyMetricCard from './EnergyMetricCard';
import EnergyMetricDetailModal from './EnergyMetricDetailModal';
import styles from './EnergyElectricalHealth.module.css';

export default function EnergyElectricalHealth({ refreshKey = 0 }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState(null);

  const fetchSummary = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await axios.get('/api/energy-meter/electrical-health', {
        params: { range: '1h' },
        withCredentials: true,
      });
      setSummary(res.data);
    } catch (err) {
      console.error('Electrical health fetch failed:', err);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary(true);
    const interval = setInterval(() => fetchSummary(false), 30000);
    return () => clearInterval(interval);
  }, [fetchSummary, refreshKey]);

  const renderCardGrid = () => (
    <div className={styles.cardGrid}>
      {ELECTRICAL_HEALTH_METRICS.map((metricDef) => (
        <EnergyMetricCard
          key={metricDef.key}
          metricDef={metricDef}
          summary={summary?.metrics?.[metricDef.key]}
          onClick={() => setSelectedMetric(metricDef.key)}
        />
      ))}
    </div>
  );

  return (
    <section className={styles.section}>
      <h6 className={styles.sectionTitle}>Electrical Health</h6>

      {loading && !summary ? (
        <div className={styles.loading}>
          <Spinner animation="border" size="sm" variant="primary" />
        </div>
      ) : (
        renderCardGrid()
      )}

      <EnergyMetricDetailModal
        show={Boolean(selectedMetric)}
        metricKey={selectedMetric}
        onHide={() => setSelectedMetric(null)}
        refreshKey={refreshKey}
      />
    </section>
  );
}
