// SensorGauge.jsx
import React from "react";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import clsx from "clsx";      

const SensorGauge = ({
  value,
  label,
  alertLevel = null,          // NEW ("HIGH", "LOW LOW", … or null)
  min = 0,
  max = 60,
}) => {  const pct = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
  // choose colour class
  const colourClass =
    alertLevel === "HIGH" || alertLevel === "HIGH HIGH"
      ? "gauge-red"
      : alertLevel === "LOW" || alertLevel === "LOW LOW"
      ? "gauge-pink"
      : "gauge-blue";

  const blinkClass =
    alertLevel === "HIGH HIGH" || alertLevel === "LOW LOW"
      ? "blink"
      : "";

  const data = [{ name: label, uv: pct, fill: "currentColor" }];

  return (
<div
      className={clsx("flex flex-col items-center", colourClass, blinkClass)}
      style={{ width: 140, textAlign: "center" }}
    >      <RadialBarChart
        width={140}
        height={140}
        innerRadius="80%"
        outerRadius="100%"
        data={data}
        startAngle={180}
        endAngle={0}
      >
        {/* FIX: tell Recharts what 0 – 100 % means */}
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />

        <RadialBar
          dataKey="uv"
          background
          clockWise
          cornerRadius={10}
          minAngle={2}
        />
      </RadialBarChart>

      <div style={{ fontSize: 20, fontWeight: 600 }}>{value}°C</div>
      <div style={{ fontSize: 16, color: "#64748b" }}>{label}</div>
    </div>
  );
};

export default SensorGauge;
