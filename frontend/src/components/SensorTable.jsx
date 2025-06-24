// SensorTable.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Table, Row, Col, Form, Spinner } from "react-bootstrap";
import styles from "../pages/MainContent.module.css";
import "../pages/MainContent.css";

const rowsPerPage = 9;          // keep identical to old dashboard

const TH = { highHigh: 50, high: 35, low: 25, lowLow: 10 };   // °C thresholds

const getLevel = (vals) => {
  const hi = Math.max(...vals);
  const lo = Math.min(...vals);
  if (hi >= TH.highHigh) return "highHigh";
  if (hi >= TH.high)     return "high";
  if (lo <= TH.lowLow)   return "lowLow";
  if (lo <= TH.low)      return "low";
  return "normal";
};

export default function SensorTable({ deviceId }) {
  /* -------- state -------- */
  const [role, setRole] = useState("");
  const [companyName, setCompanyName] = useState("");

  const [sensorData,  setSensorData]  = useState([]);
  const [totalPages,  setTotalPages]  = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const [searchColumn, setSearchColumn] = useState("");
  const [searchTerm,   setSearchTerm]   = useState("");
  const [sortAsc,      setSortAsc]      = useState(false);

  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [selectAll,    setSelectAll]   = useState(false);
  const [selectedRows, setSelectedRows]= useState([]);
  const [fetchTime, setFetchTime] = useState(new Date());

  const [selectedUID, setSelectedUID] = useState("All Devices");
  const [allUIDs, setAllUIDs] = useState([]);



  /* -------- helpers -------- */
  const fetchUserInfo = async () => {
    const res = await axios.get("/api/auth/userinfo", { withCredentials: true });
    setRole(res.data.role);
    setCompanyName(res.data.companyName);
    return res.data;
  };

  /* -------- page fetch -------- */
  const fetchSensorPage = async (page = 1) => {
  setRefreshing(true);

  const res = await axios.get("/api/levelsensor", {
    withCredentials: true,
    params: {
      page,
      limit: rowsPerPage,
      search: searchTerm,
      column: searchColumn,
      sort: sortAsc ? "asc" : "desc",
      uid: selectedUID !== "All Devices" ? selectedUID : undefined,
    },
  });

  setSensorData(res.data.data);
  setTotalPages(Math.max(1, Math.ceil(res.data.total / rowsPerPage)));

 

  setLastUpdated(new Date());
  setFetchTime(new Date());
  setRefreshing(false);
};

  

  /* -------- initial load -------- */
  useEffect(() => {
    (async () => {
      await fetchUserInfo();
      await fetchSensorPage(currentPage); // use current state
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------- search / sort change -------- */
useEffect(() => {
  const delay = setTimeout(() => {
    if (!loading) {
      fetchSensorPage(1);
    }
  }, 300);
  return () => clearTimeout(delay);
}, [searchTerm, searchColumn, sortAsc, selectedUID, loading]);


  /* -------- page change -------- */
  useEffect(() => { fetchSensorPage(currentPage); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPage]);

  /* -------- auto-refresh -------- */
  useEffect(() => {
  const id = setInterval(() => {
    fetchSensorPage(currentPage); // already respects selectedUID and searchTerm
  }, 30000);
  return () => clearInterval(id);
}, [currentPage, selectedUID, searchColumn, searchTerm, sortAsc]);


  useEffect(() => {
  const init = async () => {
    try {
      const user = await fetchUserInfo(); // sets role and companyName

      // Fetch UIDs AFTER we have role/company
      const uidRes = await axios.get("/api/levelsensor/uids", {
        withCredentials: true,
      });

      const deviceUIDs = uidRes.data || [];
      setAllUIDs(["All Devices", ...deviceUIDs]);

      // ✅ Only update UID if not already selected
setSelectedUID((prev) =>
  prev === "All Devices" && deviceUIDs.length > 0 ? deviceUIDs[0] : prev
);


      // await fetchSensorPage(currentPage);
      setLoading(false);
    } catch (err) {
      console.error("Initialization error:", err);
      setAllUIDs(["All Devices"]);
      setLoading(false);
    }
  };

  init();
}, []);



  /* -------- UI -------- */
  if (loading) {
    return (
      <div className="d-flex justify-content-center my-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <>
      <div className="d-flex align-items-center justify-content-between">
        <h6 className="mb-0">Sensor Data Logs</h6>
        {lastUpdated && (
          <small className="text-muted d-flex align-items-center">
            Last updated:&nbsp;<strong>{lastUpdated.toLocaleTimeString()}</strong>
            {refreshing && (
              <Spinner animation="border" variant="secondary" size="sm" className="ms-2" />
            )}
          </small>
        )}
      </div>

      {/* search bar */}
      <Row className="mb-3 mt-2">
  <Col md={3}>
    <Form.Select
      value={selectedUID}
      onChange={(e) => {
        setSelectedUID(e.target.value);
        setCurrentPage(1);
      }}
      className="custom_input1"
    >
      {allUIDs.map((uid, idx) => (
        <option key={idx} value={uid}>
          {uid}
        </option>
      ))}
    </Form.Select>
  </Col>
  <Col md={3}>
    <Form.Select
      value={searchColumn}
      onChange={(e) => setSearchColumn(e.target.value)}
      className="custom_input1"
    >
      <option value="">All Columns</option>
      <option value="D">Date</option>
      <option value="address">Location</option>
      <option value="vehicleNo">Vehicle No.</option>
      <option value="data">Data</option>
    </Form.Select>
  </Col>
  <Col md={6}>
    <Form.Control
      placeholder="Search…"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="custom_input1"
    />
  </Col>
</Row>


      {/* table */}
      <div className="tableScroll">
        <Table striped bordered hover responsive className="db1_table">
          <thead>
            <tr>
              <th>
                <Form.Check
                  checked={selectAll}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setSelectAll(isChecked);
                    setSelectedRows(isChecked ? sensorData.map((d) => d._id) : []);
                  }}
                />
              </th>
              <th style={{ cursor: "pointer" }} onClick={() => setSortAsc(!sortAsc)}>
                Date {sortAsc ? "↑" : "↓"}
              </th>
              <th>Location</th>
              <th>Data</th>
              <th>Vehicle No.</th>
            </tr>
          </thead>
          <tbody>
  {sensorData.length === 0 ? (
    <tr>
      <td colSpan="5" className="text-center">No sensor data found</td>
    </tr>
  ) : (
    sensorData.map((row, idx) => {
      const vals   = Array.isArray(row.data) ? row.data.map(v => v / 10) : [row.data / 10];
      const level  = getLevel(vals);                        // high / low / normal
      const tint   = level !== "normal" ? `row-${level}` : "";
      const recent = Date.now() - fetchTime.getTime() < 30_000;
      const blink  = idx === 0 && level !== "normal" && recent ? "blink" : "";

      return (
        <tr
  key={row._id}
  className={blink}                         // keep blink animation
  style={{
    background:
      level === "highHigh" ? "rgba(239,68,68,.25)"  :      // deep red
      level === "high"     ? "rgba(252,165,165,.25)" :      // light red
      level === "lowLow"   ? "rgba(236,72,153,.25)"  :      // deep pink
      level === "low"      ? "rgba(249,168,212,.25)" :      // light pink
      "transparent"
  }}
>

          <td>
            <Form.Check
              checked={selectedRows.includes(row._id)}
              onChange={e => {
                const chk = e.target.checked;
                setSelectedRows(prev => chk ? [...prev, row._id] : prev.filter(id => id !== row._id));
                if (!chk) setSelectAll(false);
              }}
            />
          </td>
          <td>{row.D}</td>
          <td>{row.address}</td>
<td>
  {vals.map((v, i) => `T${i + 1}: ${v.toFixed(1)}°C`).join(" | ")}
</td>
          <td>{row.vehicleNo}</td>
        </tr>
      );
    })
  )}
</tbody>

        </Table>
      </div>

      {/* pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-center mt-3">
          <nav>
            <ul className="pagination modern-pagination">
              <li className={`page-item ${currentPage === 1 && "disabled"}`}>
                <button className="page-link" onClick={() => setCurrentPage((p) => p - 1)}>
                  Prev
                </button>
              </li>
              {(() => {
                const pages = [];
                if (totalPages <= 5) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  if (currentPage <= 3) pages.push(1, 2, 3, 4, "…", totalPages);
                  else if (currentPage >= totalPages - 2)
                    pages.push(1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                  else
                    pages.push(
                      1,
                      "…",
                      currentPage - 1,
                      currentPage,
                      currentPage + 1,
                      "…",
                      totalPages
                    );
                }
                return pages.map((pg, idx) => (
                  <li
                    key={idx}
                    className={`page-item ${pg === currentPage ? "active" : ""} ${
                      pg === "…" && "disabled"
                    }`}
                  >
                    {pg === "…" ? (
                      <span className="page-link">…</span>
                    ) : (
                      <button className="page-link" onClick={() => setCurrentPage(pg)}>
                        {pg}
                      </button>
                    )}
                  </li>
                ));
              })()}
              <li className={`page-item ${currentPage === totalPages && "disabled"}`}>
                <button className="page-link" onClick={() => setCurrentPage((p) => p + 1)}>
                  Next
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
