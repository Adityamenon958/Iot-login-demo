/* ─── imports ─── */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Col, Row, Form, Spinner } from "react-bootstrap";
import axios from "axios";
import styles from "../pages/MainContent.module.css";
import SensorGaugeStrip from "../components/SensorGaugeStrip";
import SensorTable from "../components/SensorTable";
import LineChartPanel from "../components/LineChartPanel";
import AlarmHistoryTable from "../components/AlarmHistoryTable";

/* ─── component ─── */
export default function DynamicDb() {
  const navigate = useNavigate();

  /* devices & selection */
  const [devices,     setDevices]     = useState([]);   // [{ uid, deviceId, location }]
  const [selectedUid, setSelectedUid] = useState("");   // current UID

  /* gauge state */
  const [sensors,      setSensors]      = useState([]);
  const [gaugeLoading, setGaugeLoading] = useState(true);
  const [initLoading,  setInitLoading]  = useState(true); // first load spinner

  /* ─── 1. fetch device list on mount ─── */
  useEffect(() => {
    (async () => {
      try {
        /* who am I? */
        const info = await axios.get("/api/auth/userinfo", { withCredentials: true });
        const company = info.data.companyName;

        /* devices I’m allowed to see */
        const devRes = await axios.get("/api/devices", {
          params: { companyName: company },
          withCredentials: true,
        });

        setDevices(devRes.data);                 // [{uid, ...}, …]
        if (devRes.data.length) setSelectedUid(devRes.data[0].uid);
      } catch (err) {
        console.error("Init fetch error", err);
      } finally {
        setInitLoading(false);
      }
    })();
  }, []);

  /* ─── 2. fetch latest sensor row when UID changes ─── */
  /* ---------- Gauge fetch (initial + 30-sec auto-refresh) ---------- */
useEffect(() => {
  if (!selectedUid) return;

  // ⬇︎ one-shot fetch wrapped in a helper
  const fetchLatestGauge = async () => {
    try {
      setGaugeLoading(true);

      const res = await axios.get("/api/levelsensor/latest", {
        params: { uid: selectedUid },
        withCredentials: true,
      });

      const latest = res.data;
      if (!latest) {
        setSensors([]);
        return;
      }

      const parsed = latest.data.map((raw, i) => ({
        id:    `S${i + 1}`,
        label: `T${i + 1}`,
        level: raw / 10,   // 270 → 27 °C
      }));
      setSensors(parsed);
    } catch (err) {
      console.error("Gauge fetch error", err);
      setSensors([]);
    } finally {
      setGaugeLoading(false);
    }
  };

  /* 1️⃣ run immediately */
  fetchLatestGauge();

  /* 2️⃣ refresh every 30 000 ms */
  const id = setInterval(fetchLatestGauge, 30_000);

  /* cleanup when uid changes or component unmounts */
  return () => clearInterval(id);
}, [selectedUid]);


  /* ─── render ─── */
  if (initLoading) {
    return (
      <Col className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
        <Spinner animation="border" />
      </Col>
    );
  }

  const activeDev = devices.find((d) => d.uid === selectedUid);

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main3}>
      {/* Row 1 */}
      <Row className={`w-100 gx-3 ${styles.toprow}`}>
        {/* Device info */}
        <Col xs={12} lg={4} className={styles.panelDO}>
          <div className={styles.panelInner}>
            <h5 className="fw-bold mb-3">Device Overview</h5>

            <Form.Select
              size="sm"
              value={selectedUid}
              onChange={(e) => {
                setSelectedUid(e.target.value);
                navigate(`/dashboard/device/${e.target.value}`);
              }}
              className="mb-3"
            >
              {devices.map((d) => (
                <option key={d.uid} value={d.uid}>
                  {d.uid /* show uid for now */}
                </option>
              ))}
            </Form.Select>

            <ul className="list-unstyled mb-0">
              <li className="mb-2">
                <span className="text-muted">Device UID:&nbsp;</span>
                <span className="fw-semibold">{selectedUid}</span>
              </li>
              <li className="mb-2">
                <span className="text-muted">Location:&nbsp;</span>
                <span className="fw-semibold">
                  {activeDev?.location || "—"}
                </span>
              </li>
            </ul>
          </div>
        </Col>

        {/* Gauge strip */}
        <Col xs={12} lg={8} className={styles.panelSG}>
          <div className={styles.panelInner}>
            {gaugeLoading ? (
              <div className="d-flex justify-content-center py-4">
                <Spinner animation="border" />
              </div>
            ) : (
              <SensorGaugeStrip sensors={sensors} />
            )}
          </div>
        </Col>
      </Row>

      {/* Row 2 */}
      <Row className={`w-100 gx-3 gy-3 ${styles.bottomrow} p-0`}>
        <Col xs={12} lg={5} className={styles.panelST}>
          <SensorTable deviceId={selectedUid} />
        </Col>
        <Col xs={12} lg={7} className={` d-flex flex-column gap-3 ${styles.panelLCAT} `}>
          <div className={`${styles.panelLC} flex-grow-1`}>
            <div className={styles.panelInner}>
          <LineChartPanel uid={selectedUid} />
            </div>
          </div>
          <div className={styles.panelAT} style={{ minHeight: 250 }}>
            <div className={styles.panelInnertable}>
              <AlarmHistoryTable uid={selectedUid} />
              </div>
          </div>
        </Col>
      </Row>
    </Col>
  );
}
