// SensorGauge.jsx
import React, { useMemo } from "react";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

/* 🚩 hard-coded thresholds for now – will come from
   company settings later */
const TH = { highHigh: 50, high: 35, low: 25, lowLow: 10 };

const SensorGauge = ({ value, label, min = 0, max = 60 }) => {
  /* %-fill for the arc */
  const pct = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
  const data = useMemo(() => [{ uv: pct }], [pct]);

  /* decide alarm level */
  let alert = null;
  if (value >= TH.highHigh) alert = "HIGH HIGH";
  else if (value >= TH.high) alert = "HIGH";
  else if (value <= TH.lowLow) alert = "LOW LOW";
  else if (value <= TH.low) alert = "LOW";

  /* map to global CSS classes */
  const colourClass =
    alert === "HIGH" || alert === "HIGH HIGH"
      ? "gauge-red"
      : alert === "LOW" || alert === "LOW LOW"
      ? "gauge-pink"
      : "gauge-blue";

  const blinkClass =
    alert === "HIGH HIGH" || alert === "LOW LOW" ? "blink" : "";

  return (
    <div
      className={`d-flex flex-column align-items-center ${colourClass} ${blinkClass}`}
      style={{ width: 140, textAlign: "center", marginTop: 25 }}
    >
      <RadialBarChart
        width={140}
        height={140}
        innerRadius="90%"
        outerRadius="130%"
        data={data}
        startAngle={190}
        endAngle={-10}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        {/* 🖌️ inherit the container colour */}
        <RadialBar
          dataKey="uv"
          fill="currentColor"
          background
          clockWisenerRadiu
          cors={10}
          cornerRadius="50%" 
          minAngle={2}
        />
      </RadialBarChart>

      <div style={{ fontSize: 20, fontWeight: 600, marginTop: -40 }}>
        {value.toFixed(1)}°C
      </div>
      <div style={{ fontSize: 16, color: "#64748b" }}>{label}</div>
    </div>
  );
};

export default SensorGauge;
