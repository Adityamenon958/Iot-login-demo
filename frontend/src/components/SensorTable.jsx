// SensorTable.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Table, Row, Col, Form, Spinner } from "react-bootstrap";
import styles from "../pages/MainContent.module.css";

const rowsPerPage = 9;          // keep identical to old dashboard

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
        /* ⭐ TODO (router filter) – when backend supports it, add: */
        // deviceId
      },
    });

    setSensorData(res.data.data);
    setTotalPages(Math.max(1, Math.ceil(res.data.total / rowsPerPage)));
    setLastUpdated(new Date());
    setRefreshing(false);
  };

  /* -------- initial load -------- */
  useEffect(() => {
    (async () => {
      await fetchUserInfo();
      await fetchSensorPage(1);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------- search / sort change -------- */
  useEffect(() => {
    const t = setTimeout(() => fetchSensorPage(1), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, searchColumn, sortAsc]);

  /* -------- page change -------- */
  useEffect(() => { fetchSensorPage(currentPage); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPage]);

  /* -------- auto-refresh -------- */
  useEffect(() => {
    const id = setInterval(() => fetchSensorPage(currentPage), 30000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

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
        <Col md={4}>
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
        <Col md={8}>
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
                <td colSpan="5" className="text-center">
                  No sensor data found
                </td>
              </tr>
            ) : (
              sensorData.map((row) => (
                <tr key={row._id}>
                  <td>
                    <Form.Check
                      checked={selectedRows.includes(row._id)}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setSelectedRows((prev) =>
                          isChecked ? [...prev, row._id] : prev.filter((id) => id !== row._id)
                        );
                        if (!isChecked) setSelectAll(false);
                      }}
                    />
                  </td>
                  <td>{row.D}</td>
                  <td>{row.address}</td>
                  <td>
   {Array.isArray(row.data)
     ? row.data.map((v) => (v / 10).toFixed(1)).join(", ")
     : (row.data / 10).toFixed(1)}{" "}
   °C
 </td>
                  <td>{row.vehicleNo}</td>
                </tr>
              ))
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
