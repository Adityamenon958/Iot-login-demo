// LineChartPanel.jsx  – with 30-second auto-refresh (optimized)
import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import {
   LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
   Legend, ResponsiveContainer, ReferenceLine          /* ← NEW */
 } from "recharts";
import { Form, Spinner } from "react-bootstrap";
import { format, parse, subMinutes, subHours, subDays } from "date-fns";
import styles from "../pages/MainContent.module.css";

/* ---- range presets ---- */
const ranges = [
  { label: "15 min", key: "15m", from: () => subMinutes(new Date(), 15) },
  { label: "30 min", key: "30m", from: () => subMinutes(new Date(), 30) },
  { label: "1 hour", key: "1h", from: () => subHours(new Date(), 1) },
  { label: "24 hrs", key: "24h", from: () => subHours(new Date(), 24) },
  { label: "Weekly", key: "7d", from: () => subDays(new Date(), 7) },
];
const colors = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];
/* same four numbers the gauges use – later we’ll load these per-company */
const TH = { highHigh: 50, high: 35, low: 25, lowLow: 10 };
const MAX_POINTS = 300; // cap rendered points for faster paint

// Simple stride downsampling to cap points count
function downsampleByStride(rows, maxPoints) {
  if (!Array.isArray(rows) || rows.length <= maxPoints) return rows;
  const stride = Math.ceil(rows.length / maxPoints);
  const out = [];
  for (let i = 0; i < rows.length; i += stride) out.push(rows[i]);
  return out;
}

export default function LineChartPanel({ uid }) {
  const [rangeKey, setRangeKey] = useState("15m");
  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [soloKey,  setSoloKey]  = useState(null);
  const chartRef = useRef(null);
  
  // Compute fromDate once per range change
  const fromDate = useMemo(() => ranges.find((r) => r.key === rangeKey).from(), [rangeKey]);

  /* ------------ data fetch helper ------------ */
  const fetchRows = async () => {
    if (!uid) return;

    try {
      setLoading(true);

      const res = await axios.get("/api/levelsensor", {
        withCredentials: true,
        params: {
          page: 1,
          limit: 500,
          sort: "desc",
          uid: uid,
          from: fromDate.toISOString(), // let backend filter if supported
        },
      });

      const rows = res.data.data
        .filter((doc) => doc.D)
        .map((doc) => {
          // prefer server-provided ISO date when available
          const ts = doc.dateISO ? new Date(doc.dateISO) : parse(doc.D, "dd/MM/yyyy HH:mm:ss", new Date());
          if (isNaN(ts)) return null; // skip invalid timestamps
          if (ts < fromDate) return null;

          const row = { ts };
          if (doc.readings) {
            Object.entries(doc.readings).forEach(([key, val]) => {
              row[key] = val;
            });

          } else if (Array.isArray(doc.data)) {
            doc.data.forEach((raw, i) => {
              row[`T${i + 1}`] = raw / 10;
            });
          }

          return row;
        })
        .filter(Boolean)
        .reverse();                              // oldest → newest

      // cap points rendered for performance
      const capped = downsampleByStride(rows, MAX_POINTS);

      /* ── evaluate ONLY the latest reading ── */
      let latestVals = [];
      if (capped.length) {
        const newest = capped[capped.length - 1];          // newest == last
        latestVals = Object.keys(newest)
          .filter(k => k !== "ts")
          .map(k => newest[k]);
      }

      setAlarmLines({
        highHigh: latestVals.some(v => v >= TH.highHigh),
        high:     latestVals.some(v => v >= TH.high && v < TH.highHigh),
        lowLow:   latestVals.some(v => v <= TH.lowLow),
        low:      latestVals.some(v => v <= TH.low && v > TH.lowLow)
      });

      setData(capped);
    } catch (err) {
      if (import.meta.env.DEV) console.error("LineChart fetch err", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const [alarmLines, setAlarmLines] = useState({
    highHigh: false, 
    high: false, 
    low: false, 
    lowLow: false
});

  /* ------------ initial + range/uid change + auto-refresh ------------ */
  useEffect(() => {
    if (!uid) return;

    /* 1️⃣ immediate load */
    fetchRows();

    /* 2️⃣ 30-second polling */
    const id = setInterval(fetchRows, 30_000);
    return () => clearInterval(id);
  }, [uid, rangeKey]);

  /* ------------ click outside clears solo selection ------------ */
  useEffect(() => {
    const h = (e) => {
      if (chartRef.current && !chartRef.current.contains(e.target)) setSoloKey(null);
    };
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, []);

  /* ------------ helpers ------------ */
  const seriesKeys = useMemo(() => (data[0] ? Object.keys(data[0]).filter((k) => k !== "ts") : []), [data]);

  const safeFmt = (d, fmt) => (isNaN(d) ? "" : format(d, fmt));

  /* ------------ UI ------------ */
  return (
    <div ref={chartRef} className={styles.chartPanel}>
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
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="ts"
              tickFormatter={(t) => safeFmt(new Date(t), "HH:mm")}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(t) => safeFmt(new Date(t), "dd MMM, HH:mm:ss")}
            />
            <Legend
              onClick={(e) => setSoloKey((prev) => (prev === e.value ? null : e.value))}
            />

            {/* dashed threshold guides */}
{alarmLines.highHigh && (
  <ReferenceLine
    y={TH.highHigh}
    stroke="#dc2626"
    strokeDasharray="6 4"
    strokeWidth={2}
    label={{ value: "HIGH HIGH", position: "insideTopRight", fontSize: 11, fill: "#dc2626" }}
  />
)}

{alarmLines.high && !alarmLines.highHigh && (
  <ReferenceLine
    y={TH.high}
    stroke="#f87171"
    strokeDasharray="6 4"
    strokeWidth={2}
    label={{ value: "HIGH", position: "insideTopRight", fontSize: 11, fill: "#f87171" }}
  />
)}

{alarmLines.lowLow && (
  <ReferenceLine
    y={TH.lowLow}
    stroke="#ec4899"
    strokeDasharray="6 4"
    strokeWidth={2}
    label={{ value: "LOW LOW", position: "insideTopRight", fontSize: 11, fill: "#ec4899" }}
  />
)}

{alarmLines.low && !alarmLines.lowLow && (
  <ReferenceLine
    y={TH.low}
    stroke="#f9a8d4"
    strokeDasharray="6 4"
    strokeWidth={2}
    label={{ value: "LOW", position: "insideTopRight", fontSize: 11, fill: "#f9a8d4" }}
  />
)}


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
                    isAnimationActive={false}
                  />
                )
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
