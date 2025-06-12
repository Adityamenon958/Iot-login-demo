import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Col, Row, Form } from "react-bootstrap";
import styles from "../pages/MainContent.module.css";
import SensorBars from "../components/SensorBars";


export default function DynamicDb() {
  const navigate = useNavigate();
  const { deviceId } = useParams();            // URL param
  const devices = ["TRB245-01", "TRB245-02", "TRB245-03"]; // mock list
  const [selected, setSelected] = useState(deviceId ?? devices[0]);
  const mockSensors = [
  { id: "T1", label: "T1",        level: 34 },
  { id: "T2", label: "T2",        level: 33.8 },
  { id: "T3", label: "T3",        level: 35.1 },
  { id: "T4", label: "T4",        level: 34.9 },
  { id: "H",  label: "Humidity",  level: 62  },
  { id: "T3", label: "T3",        level: 35.1 },
  { id: "T4", label: "T4",        level: 34.9 },
  { id: "H",  label: "Humidity",  level: 62  },
  // add more to test scrolling
];



  const handleChange = (e) => {
    const newId = e.target.value;
    setSelected(newId);
    navigate(`/dashboard/device/${newId}`);    // redirect
  };
  return (
    <Col xs={12} md={9} lg={10} xl={10} className={styles.main3}>
      {/* ─── Row 1 ─── */}
     <Row className={`w-100 gx-3 ${styles.toprow}`}>
        {/* Device-info panel */}
        <Col xs={12} lg={4} className={styles.panel}>
          <div className={styles.panelInner}>
            <h5 className="fw-bold mb-3">Device Overview</h5>

            <Form.Select
              size="sm"
              value={selected}
              onChange={handleChange}
              className="mb-3"
            >
              {devices.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Form.Select>

            <ul className="list-unstyled mb-0">
              <li className="mb-2">
                <span className="text-muted">Name:&nbsp;</span>
                <span className="fw-semibold">L%T</span>
              </li>
              <li className="mb-2">
                <span className="text-muted">Device:&nbsp;</span>
                <span className="fw-semibold">{selected}</span>
              </li>
              <li className="mb-2">
                <span className="text-muted">Location:&nbsp;</span>
                <span className="fw-semibold">400007</span>
              </li>
              <li>
                <span className="text-muted">Active Alarms:&nbsp;</span>
                <span className="fw-semibold text-success">0</span>
              </li>
            </ul>
          </div>
        </Col>


        {/* top-right panel */}
<Col xs={12} lg={8} className={styles.panel}>
<div className={styles.panelInner}>
  <SensorBars sensors={mockSensors} />
  </div>
</Col>
      </Row>

      {/* ─── Row 2 ─── */}
      <Row className={`w-100 gx-3 gy-3 ${styles.bottomrow} p-0`}>
        <Col xs={12} lg={5} className={` ${styles.panel} `}>
          <div className={styles.panelInner}>Live data table</div>
        </Col>

        <Col xs={12} lg={7} className="d-flex flex-column gap-3">
          <div className={`${styles.panel} flex-grow-1`}>
            <div className={` ${styles.panelInner}`}>Line chart</div>
          </div>
          <div className={styles.panel} style={{ minHeight: "250px" }}>
            <div className={styles.panelInner}>Alarm history</div>
          </div>
        </Col>
      </Row>
    </Col>
  );
}
