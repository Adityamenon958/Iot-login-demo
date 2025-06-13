// SensorGaugeStrip.jsx
import React from "react";
import styles from "../pages/MainContent.module.css"; 
import SensorGauge from "./SensorGauge";

const GAUGE_WIDTH = 140;          /* px */
const GAP_PX = 30;

const SensorGaugeStrip = ({ sensors = [] }) => {
  return (
    <div
      className={`d-flex justify-content-center ${styles.barWrapper} `}
      style={{ gap: GAP_PX }}      /* reuse same wrapper CSS */
    >
      {sensors.map((s) => (
        <div
          key={s.id}
          style={{ width: GAUGE_WIDTH }}
          className="flex-shrink-0 "
        >
          <SensorGauge value={s.level} label={s.label} />
        </div>
      ))}
    </div>
  );
};

export default SensorGaugeStrip;
