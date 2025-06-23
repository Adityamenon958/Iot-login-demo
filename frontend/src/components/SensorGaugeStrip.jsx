// SensorGaugeStrip.jsx
import React, { useState, useEffect } from "react";
import styles from "../pages/MainContent.module.css";
import SensorGauge from "./SensorGauge";
import { levelFor } from "../../lib/thresholds";

/* Constants */
const GAUGE_WIDTH = 140;          // px
const GAP_PX = 30;
const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

const SensorGaugeStrip = ({ sensors = [] }) => {
  const [alerts, setAlerts] = useState({});

  /* Store alert levels for 30s */
  useEffect(() => {
    if (!sensors.length) return;

    sensors.forEach((s) => {
      const level = levelFor(s.level);
      if (level) {
        setAlerts((prev) => ({ ...prev, [s.id]: level }));
        setTimeout(() => {
          setAlerts((prev) => {
            const clone = { ...prev };
            delete clone[s.id];
            return clone;
          });
        }, 30_000);
      }
    });
  }, [sensors]);

  return (
    <div
      className={`d-flex justify-content-center ${styles.barWrapper}`}
      style={{ gap: GAP_PX }}
    >
      {sensors.map((s, idx) => (
        <div key={s.id} style={{ width: GAUGE_WIDTH }} className="flex-shrink-0">
          <SensorGauge
            value={s.level}
            label={s.label}
            alertLevel={alerts[s.id] || null}
            color={COLORS[idx % COLORS.length]}     // 🎨 Pass matching color
          />
        </div>
      ))}
    </div>
  );
};

export default SensorGaugeStrip;
