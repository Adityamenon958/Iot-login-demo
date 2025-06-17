// SensorGaugeStrip.jsx
import React from "react";
import styles from "../pages/MainContent.module.css"; 
import SensorGauge from "./SensorGauge";
import { levelFor } from "../../lib/thresholds";
import { useState, useEffect } from "react";

const GAUGE_WIDTH = 140;          /* px */
const GAP_PX = 30;

const SensorGaugeStrip = ({ sensors = [] }) => {
  /* keep transient (30 s) alert map: {sensorId: alertLevel} */
  const [alerts, setAlerts] = useState({});

  /* whenever new sensor values arrive … */
  useEffect(() => {
    if (!sensors.length) return;
    const now = Date.now();

    sensors.forEach((s) => {
      const level = levelFor(s.level);
      if (level) {
        /* save + schedule clear after 30 s */
        setAlerts((prev) => ({ ...prev, [s.id]: level }));
        setTimeout(
          () => setAlerts((prev) => {
            const clone = { ...prev };
            delete clone[s.id];
            return clone; }),
          30_000,
        );
      }
    });
  }, [sensors]);

  return (
    <div
      className={`d-flex justify-content-center ${styles.barWrapper}`}
      style={{ gap: GAP_PX }}
    >
      {sensors.map((s) => (
        <div key={s.id} style={{ width: GAUGE_WIDTH }} className="flex-shrink-0">
          <SensorGauge
            value={s.level}
            label={s.label}
            alertLevel={alerts[s.id] || null}
          />
        </div>
      ))}
    </div>
  );
};
export default SensorGaugeStrip;
