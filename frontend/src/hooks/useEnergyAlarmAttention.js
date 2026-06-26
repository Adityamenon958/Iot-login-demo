import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  ENERGY_PAGE_TITLE_BASE,
  PULSE_ATTENTION_MS,
  SEEN_ALARM_EVENTS_KEY,
  mapAlarmMetricsToParameterKeys,
} from '../components/energy/energyAlarmConfig';
import {
  isAlarmSoundEnabled,
  playCriticalAlarmSound,
  setAlarmSoundEnabled,
} from '../utils/energyAlarmSound';

function loadSeenEventIds() {
  try {
    const raw = sessionStorage.getItem(SEEN_ALARM_EVENTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSeenEventIds(set) {
  try {
    sessionStorage.setItem(SEEN_ALARM_EVENTS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export default function useEnergyAlarmAttention(refreshKey = 0) {
  const [summary, setSummary] = useState(null);
  const [activeEvents, setActiveEvents] = useState([]);
  const [pendingToasts, setPendingToasts] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(isAlarmSoundEnabled);
  const [pulseTick, setPulseTick] = useState(0);

  const seenEventIdsRef = useRef(loadSeenEventIds());
  const pulseRegistryRef = useRef(new Map());
  const isFirstPollRef = useRef(true);
  const baseTitleRef = useRef(document.title);

  const refresh = useCallback(async () => {
    try {
      const [summaryRes, activeRes] = await Promise.all([
        axios.get('/api/energy-meter/alarms/summary', { withCredentials: true }),
        axios.get('/api/energy-meter/alarms/events/active', { withCredentials: true }),
      ]);
      const nextSummary = summaryRes.data;
      const nextActive = activeRes.data.data || [];
      setSummary(nextSummary);
      setActiveEvents(nextActive);

      const activeIdSet = new Set(
        nextActive.filter((ev) => ev.status === 'active').map((ev) => String(ev._id))
      );
      let pulseChanged = false;
      pulseRegistryRef.current.forEach((entry, id) => {
        if (!activeIdSet.has(id)) {
          pulseRegistryRef.current.delete(id);
          pulseChanged = true;
        }
      });
      if (pulseChanged) setPulseTick((t) => t + 1);

      if (!isFirstPollRef.current) {
        const newToasts = [];
        const now = Date.now();
        nextActive.forEach((ev) => {
          if (ev.status !== 'active') return;
          const id = String(ev._id);
          if (seenEventIdsRef.current.has(id)) return;
          seenEventIdsRef.current.add(id);
          pulseRegistryRef.current.set(id, {
            meterId: ev.meterId,
            expiresAt: now + PULSE_ATTENTION_MS,
            severity: ev.severity,
          });
          newToasts.push({
            id: `toast-${id}`,
            eventId: id,
            meterId: ev.meterId,
            meterName: ev.meterName || ev.meterId,
            metric: ev.metric,
            severity: ev.severity,
            message: ev.message || ev.conditionLabel,
            grouped: false,
          });
          if (ev.severity === 'critical') playCriticalAlarmSound();
        });

        if (newToasts.length > 1) {
          setPendingToasts((prev) => [
            ...prev,
            {
              id: `toast-group-${now}`,
              grouped: true,
              count: newToasts.length,
              severity: newToasts.some((t) => t.severity === 'critical') ? 'critical' : 'warning',
              message: `${newToasts.length} new alarms`,
            },
          ]);
        } else if (newToasts.length === 1) {
          setPendingToasts((prev) => [...prev, newToasts[0]]);
        }
      } else {
        nextActive.forEach((ev) => {
          if (ev.status === 'active') {
            seenEventIdsRef.current.add(String(ev._id));
          }
        });
        isFirstPollRef.current = false;
      }

      saveSeenEventIds(seenEventIdsRef.current);
    } catch (err) {
      console.error('Alarm attention poll failed', err);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh, refreshKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      pulseRegistryRef.current.forEach((entry, id) => {
        if (entry.expiresAt <= now) {
          pulseRegistryRef.current.delete(id);
          changed = true;
        }
      });
      if (changed) setPulseTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const activeCount = summary?.activeCount ?? 0;
    if (activeCount > 0) {
      document.title = `(${activeCount}) ${ENERGY_PAGE_TITLE_BASE}`;
    } else {
      document.title = ENERGY_PAGE_TITLE_BASE;
    }
    return () => {
      document.title = baseTitleRef.current || ENERGY_PAGE_TITLE_BASE;
    };
  }, [summary?.activeCount]);

  const dismissToast = useCallback((toastId) => {
    setPendingToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const toggleSound = useCallback((enabled) => {
    setAlarmSoundEnabled(enabled);
    setSoundEnabled(enabled);
  }, []);

  const shouldPulseFleet = useCallback(() => {
    void pulseTick;
    const now = Date.now();
    for (const entry of pulseRegistryRef.current.values()) {
      if (entry.expiresAt > now) return true;
    }
    return false;
  }, [pulseTick]);

  const shouldPulseMeter = useCallback(
    (meterId) => {
      void pulseTick;
      if (!meterId) return false;
      const now = Date.now();
      for (const entry of pulseRegistryRef.current.values()) {
        if (entry.meterId === meterId && entry.expiresAt > now) return true;
      }
      return false;
    },
    [pulseTick]
  );

  const getMeterAttention = useCallback(
    (meterId) => {
      const info = summary?.byMeter?.[meterId];
      if (!info || !info.count) {
        return {
          severity: null,
          borderSeverity: null,
          pulse: false,
          metrics: [],
          parameterKeys: [],
          latestTriggeredAt: null,
          activeCount: 0,
          count: 0,
        };
      }
      const borderSeverity = info.highestSeverity;
      return {
        severity: info.highestActiveSeverity || info.highestSeverity,
        borderSeverity,
        pulse: shouldPulseMeter(meterId),
        metrics: info.metrics || [],
        parameterKeys: mapAlarmMetricsToParameterKeys(info.metrics),
        latestTriggeredAt: info.latestTriggeredAt,
        activeCount: info.activeCount || 0,
        acknowledgedCount: info.acknowledgedCount || 0,
        count: info.count || 0,
      };
    },
    [summary, shouldPulseMeter]
  );

  return {
    summary,
    byMeter: summary?.byMeter || {},
    banner: summary?.banner || null,
    fleetStatus: summary?.fleetStatus || 'normal',
    activeEvents,
    pendingToasts,
    dismissToast,
    refresh,
    soundEnabled,
    toggleSound,
    shouldPulseFleet,
    shouldPulseMeter,
    getMeterAttention,
    hasOpenAlarms: (summary?.openCount ?? 0) > 0,
    hasUnacknowledged: (summary?.activeCount ?? 0) > 0,
  };
}
