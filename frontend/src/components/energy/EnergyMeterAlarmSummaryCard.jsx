import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Spinner } from 'react-bootstrap';
import { Bell } from 'lucide-react';
import tileStyles from './EnergyParameterTiles.module.css';
import attentionStyles from './energyAlarmAttention.module.css';
import styles from './EnergyMeterAlarmSummaryCard.module.css';

export default function EnergyMeterAlarmSummaryCard({
  meterId,
  refreshKey = 0,
  onClick,
  attention,
}) {
  const [loading, setLoading] = useState(!attention);
  const [activeCount, setActiveCount] = useState(attention?.activeCount ?? 0);
  const [rulesCount, setRulesCount] = useState(0);
  const [enabledRulesCount, setEnabledRulesCount] = useState(0);

  const fetchSummary = useCallback(async () => {
    if (!meterId || attention) return;
    try {
      setLoading(true);
      const [activeRes, rulesRes] = await Promise.all([
        axios.get('/api/energy-meter/alarms/events/active', {
          params: { meterId },
          withCredentials: true,
        }),
        axios.get('/api/energy-meter/alarms/rules', {
          params: { meterId },
          withCredentials: true,
        }),
      ]);
      const active = activeRes.data.data || [];
      const rules = rulesRes.data.data || [];
      setActiveCount(active.length);
      setRulesCount(rules.length);
      setEnabledRulesCount(rules.filter((r) => r.enabled !== false).length);
    } catch (err) {
      console.error('Failed to load meter alarm summary', err);
      setActiveCount(0);
      setRulesCount(0);
      setEnabledRulesCount(0);
    } finally {
      setLoading(false);
    }
  }, [meterId, attention]);

  useEffect(() => {
    if (attention) {
      setActiveCount(attention.activeCount ?? 0);
      setLoading(false);
      return;
    }
    fetchSummary();
  }, [fetchSummary, refreshKey, attention]);

  const clickable = typeof onClick === 'function';
  const hasOpen = (attention?.count ?? 0) > 0 || activeCount > 0;
  const hasActive = (attention?.activeCount ?? activeCount) > 0;
  const pulse = attention?.pulse ?? false;
  const borderSeverity = attention?.borderSeverity;
  const pulseClass = pulse
    ? borderSeverity === 'critical'
      ? attentionStyles.pulseNewCritical
      : attentionStyles.pulseNewWarning
    : '';

  const subline = rulesCount
    ? `${enabledRulesCount} rule${enabledRulesCount !== 1 ? 's' : ''} enabled`
    : 'No rules configured';

  return (
    <div
      className={[
        tileStyles.tile,
        clickable ? tileStyles.clickable : '',
        hasOpen && borderSeverity === 'critical' ? attentionStyles.borderCritical : '',
        hasOpen && borderSeverity === 'warning' ? attentionStyles.borderWarning : '',
        hasOpen && !borderSeverity && hasActive ? styles.hasActive : '',
        pulseClass,
      ].filter(Boolean).join(' ')}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      title={clickable ? 'View alarm settings and history' : undefined}
    >
      <div className={styles.labelRow}>
        <Bell size={14} className={styles.icon} />
        <span className={tileStyles.tileLabel}>Alarms</span>
      </div>
      {loading ? (
        <div className={styles.loading}>
          <Spinner animation="border" size="sm" />
        </div>
      ) : (
        <>
          <div className={`${tileStyles.tileValue} ${hasActive ? styles.activeValue : ''}`}>
            {activeCount}
            <span className={tileStyles.unit}> active</span>
          </div>
          <div className={tileStyles.minMax}>{subline}</div>
          {clickable && <div className={tileStyles.hint}>Tap for details</div>}
        </>
      )}
    </div>
  );
}
