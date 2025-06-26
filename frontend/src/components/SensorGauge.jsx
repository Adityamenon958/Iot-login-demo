// SensorGauge.jsx
import React, { useMemo } from "react";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

const TH = { highHigh: 50, high: 35, low: 25, lowLow: 10 };

const SensorGauge = ({ value, label, min = 0, max = 60, color = "#3b82f6" }) => {
  const pct = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
  const data = useMemo(() => [{ uv: pct }], [pct]);

  let alert = null;
  if (value >= TH.highHigh) alert = "HIGH HIGH";
  else if (value >= TH.high) alert = "HIGH";
  else if (value <= TH.lowLow) alert = "LOW LOW";
  else if (value <= TH.low) alert = "LOW";

  const blinkClass =
    alert === "HIGH HIGH" || alert === "LOW LOW" ? "blink" : "";

  return (
    <div
      className={`d-flex flex-column align-items-center  ${blinkClass} `}
      style={{ width: 170, height: 150, textAlign: "center", marginTop: 10 , paddingTop: 10 }}
    >
      <RadialBarChart
        width={170}
        height={150}
        innerRadius="60%"
        outerRadius="100%"
        data={data}
        startAngle={190}
        endAngle={-10}
        
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar
          dataKey="uv"
          fill={color}                // 🎨 Custom color from prop
          background
          cornerRadius="50%"
          minAngle={2}
        />
      </RadialBarChart>

      <div style={{ fontSize: 20, fontWeight: 600, marginTop: -60, color }}>
        {value.toFixed(1)}°C
      </div>
      <div style={{ fontSize: 16, color: "#64748b" }}>{label}</div>
    </div>
  );
};

export default SensorGauge;
