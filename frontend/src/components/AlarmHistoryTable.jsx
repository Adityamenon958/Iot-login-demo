import React, { useState, useEffect } from "react";
import axios from "axios";
import { Table, Spinner } from "react-bootstrap";

export default function AlarmHistoryTable({ uid }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get("/api/alarms", {
          params: { uid, page: 1, limit: 50 },
          withCredentials: true,
        });
        setRows(res.data.data);
      } catch (err) {
        console.error("Alarm fetch", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  if (loading)
    return (
      <div className="d-flex justify-content-center py-4">
        <Spinner animation="border" />
      </div>
    );

  return (
    <Table size="sm" striped hover responsive>
      <thead>
        <tr>
          <th>Date</th>
          <th>Sensor</th>
          <th>Value (°C)</th>
          <th>Level</th>
          <th>Vehicle</th>
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
              <td>{new Date(r.dateISO).toLocaleString()}</td>
              <td>{r.sensorId}</td>
              <td>{r.value.toFixed(1)}</td>
              <td>{r.level}</td>
              <td>{r.vehicleNo}</td>
            </tr>
          ))
        )}
      </tbody>
    </Table>
  );
}
