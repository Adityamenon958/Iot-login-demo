// LineChartPanel.jsx  – with 30-second auto-refresh
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
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

export default function LineChartPanel({ uid }) {
  const [rangeKey, setRangeKey] = useState("15m");
  const [data,     setData]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [soloKey,  setSoloKey]  = useState(null);
  const chartRef = useRef(null);

  /* ------------ data fetch helper ------------ */
  const fetchRows = async () => {
    if (!uid) return;
    const { from } = ranges.find((r) => r.key === rangeKey);

    try {
      setLoading(true);

      const res = await axios.get("/api/levelsensor", {
        withCredentials: true,
        params: {
          page: 1,
          limit: 500,
          sort: "desc",
          column: "uid",
          search: uid,
        },
      });

      const rows = res.data.data
        .filter((doc) => doc.D)
        .map((doc) => {
          const ts = parse(doc.D, "dd/MM/yyyy HH:mm:ss", new Date());
          if (ts < from()) return null;          // outside selected window

          const row = { ts };
          doc.data.forEach((raw, i) => (row[`S${i + 1}`] = raw / 10));
          return row;
        })
        .filter(Boolean)
        .reverse();                              // oldest → newest

      setData(rows);
    } catch (err) {
      console.error("LineChart fetch err", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

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
  const seriesKeys = data[0] ? Object.keys(data[0]).filter((k) => k !== "ts") : [];
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
        <ResponsiveContainer width="100%" height={270}>
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
