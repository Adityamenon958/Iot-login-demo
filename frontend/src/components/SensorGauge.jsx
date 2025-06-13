// SensorGauge.jsx
import React from "react";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

const SensorGauge = ({ value, label, min = 0, max = 60 }) => {
  const pct = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
  const data = [{ name: label, uv: pct, fill: "#3b82f6" }];

  return (
    <div className="flex flex-col " style={{ width: 140, textAlign: "center" }}>
      <RadialBarChart
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
