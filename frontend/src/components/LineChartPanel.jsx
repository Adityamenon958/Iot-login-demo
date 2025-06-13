// LineChartPanel.jsx  (patched)
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Form, Spinner } from "react-bootstrap";
import { format, parse, subMinutes, subHours, subDays } from "date-fns";

const ranges = [
  { label: "15 min", key: "15m", from: () => subMinutes(new Date(), 15) },
  { label: "30 min", key: "30m", from: () => subMinutes(new Date(), 30) },
  { label: "1 hour", key: "1h", from: () => subHours(new Date(), 1) },
  { label: "24 hrs", key: "24h", from: () => subHours(new Date(), 24) },
  { label: "Weekly", key: "7d", from: () => subDays(new Date(), 7) },
];
const colors = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

export default function LineChartPanel({ uid }) {
  const [rangeKey, setRangeKey] = useState("15m");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soloKey, setSoloKey] = useState(null);
  const chartRef = useRef(null);

  /* fetch rows */
  useEffect(() => {
    if (!uid) return;
    const { from } = ranges.find((r) => r.key === rangeKey);

    (async () => {
      try {
        setLoading(true);

        const res = await axios.get("/api/levelsensor", {
          withCredentials: true,
          params: {
            page: 1,
            limit: 500,
            sort: "asc",
            column: "uid",
            search: uid,
          },
        });

        const rows = res.data.data
   .filter((doc) => doc.D)                           // keep rows that have D
   .map((doc) => {
     /* 1️⃣ parse “24/07/2024 13:45:55” as *local* Date               */
     const ts = parse(doc.D, "dd/MM/yyyy HH:mm:ss", new Date());
     /* 2️⃣ skip if outside the selected range                        */
     if (ts < from()) return null;

     const row = { ts };
            doc.data.forEach((raw, i) => (row[`S${i + 1}`] = raw / 10));
            return row;
          })
          .filter(Boolean);

        setData(rows);
      } catch (err) {
        console.error("LineChart fetch err", err);
        setData([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid, rangeKey]);

  /* click–outside resets solo */
  useEffect(() => {
    const h = (e) => {
      if (chartRef.current && !chartRef.current.contains(e.target)) setSoloKey(null);
    };
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, []);

  const seriesKeys = data[0] ? Object.keys(data[0]).filter((k) => k !== "ts") : [];

  /* helper to avoid format() on invalid date */
  const safeFmt = (d, fmt) => (isNaN(d) ? "" : format(d, fmt));

  return (
    <div ref={chartRef}>
      <Form.Select
        size="sm"
        value={rangeKey}
        onChange={(e) => setRangeKey(e.target.value)}
        style={{ width: 150 }}
        className="mb-2"
      >
        {ranges.map((r) => (
          <option key={r.key} value={r.key}>
            {r.label}
          </option>
        ))}
      </Form.Select>

      {loading ? (
        <div className="d-flex justify-content-center my-5">
          <Spinner animation="border" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="ts"
              tickFormatter={(t) => safeFmt(new Date(t), "HH:mm")}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(t) =>
                safeFmt(new Date(t), "dd MMM, HH:mm:ss")
              }
            />
            <Legend
              onClick={(e) => setSoloKey((prev) => (prev === e.value ? null : e.value))}
            />
            {seriesKeys.map(
              (k, idx) =>
                (!soloKey || soloKey === k) && (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stroke={colors[idx % colors.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                )
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
