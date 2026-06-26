import React, { useEffect } from 'react';
import { Toast, ToastContainer } from 'react-bootstrap';
import { getMetricLabel } from './energyAlarmConfig';
import styles from './EnergyAlarmToastStack.module.css';

const AUTO_DISMISS_MS = 5000;

export default function EnergyAlarmToastStack({ toasts = [], onDismiss, onToastClick }) {
  useEffect(() => {
    if (!toasts.length) return undefined;
    const timers = toasts.map((t) =>
      setTimeout(() => onDismiss?.(t.id), AUTO_DISMISS_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismiss]);

  if (!toasts.length) return null;

  return (
    <ToastContainer position="top-end" className={styles.container}>
      {toasts.map((toast) => {
        const isCritical = toast.severity === 'critical';
        const title = toast.grouped
          ? toast.message
          : `${toast.meterName || toast.meterId} — ${getMetricLabel(toast.metric)}`;
        const body = toast.grouped ? 'Click to view alarms' : toast.message;

        return (
          <Toast
            key={toast.id}
            className={`${styles.toast} ${isCritical ? styles.critical : styles.warning}`}
            onClick={() => onToastClick?.(toast)}
            role="alert"
          >
            <Toast.Header closeButton={false}>
              <strong className="me-auto">{title}</strong>
              <small>now</small>
            </Toast.Header>
            <Toast.Body>{body}</Toast.Body>
          </Toast>
        );
      })}
    </ToastContainer>
  );
}
