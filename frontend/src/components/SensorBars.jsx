// SensorBars.jsx
import React from "react";
import styles from "../pages/MainContent.module.css";   // same CSS-module that holds .barWrapper etc.

const BAR_PX = 60;            // ≈ one-quarter of the old width

const SensorBars = ({ sensors = [] }) => {
  if (!sensors.length) return null;

  return (
    <div className={styles.barWrapper}>
      {sensors.map((s) => {
        const height = Math.min(Number(s.level), 100);   // clamp 0-100 %
        return (
          <div
            key={s.id}
            className={styles.sensorBar}
            style={{ width: `${BAR_PX}px` }}             // ⇦  fixed width
          >
            <div className={styles.barContainer}>
              <div
                className={styles.barFill}
                style={{ height: `${height}%` }}
              />
            </div>
            <div className={styles.barValue}>{s.level}</div>
            <div className={styles.barLabel}>{s.label}</div>
          </div>
        );
      })}
    </div>
  );
};

export default SensorBars;
