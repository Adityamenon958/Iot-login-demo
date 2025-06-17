// AlarmHistoryTable.jsx  – fixed scrolling header + latest-10
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Table, Spinner } from "react-bootstrap";

export default function AlarmHistoryTable({ uid }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  /* fetch newest 10 */
  const fetchAlarms = async () => {
    if (!uid) return;
    try {
      const res = await axios.get("/api/alarms", {
        params: { uid, page: 1, limit: 10 },   // ← newest 10
        withCredentials: true,
      });
      setRows(res.data.data);
    } catch (err) {
      console.error("Alarm fetch", err);
      setRows([]);
    }
  };

  /* initial + auto-refresh */
  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    fetchAlarms().finally(() => setLoading(false));
    const id = setInterval(fetchAlarms, 30_000);
    return () => clearInterval(id);
  }, [uid]);

  if (loading)
    return (
      <div className="d-flex justify-content-center py-4">
        <Spinner animation="border" />
      </div>
    );

  return (
    /* ① scroll-box */
    <div style={{ maxHeight: 220, overflowY: "auto" }}>
      <Table size="sm" striped hover responsive className="mb-0">
        <thead>
          <tr>
            <th style={sticky}>Date</th>
            <th style={sticky}>Sensor</th>
            <th style={sticky}>Value (°C)</th>
            <th style={sticky}>Level</th>
            <th style={sticky}>Vehicle</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan="5" className="text-center">
                No alarms
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r._id}>
 <td>{r.D || r.dateISO}</td>
              <td>{r.sensorId}</td>
                <td>{r.value.toFixed(1)}</td>
                <td>{r.level}</td>
                <td>{r.vehicleNo}</td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}

/* sticky header cell style */
const sticky = {
  position: "sticky",
  top: 0,
  background: "#fff",
  zIndex: 1,
};
