import React from 'react';
import { Modal } from 'react-bootstrap';
import EnergyMeterActiveAlarms from './EnergyMeterActiveAlarms';
import EnergyMeterAlarmSettings from './EnergyMeterAlarmSettings';
import EnergyMeterAlarmHistory from './EnergyMeterAlarmHistory';
import styles from './EnergyMeterAlarmDetailModal.module.css';

export default function EnergyMeterAlarmDetailModal({
  show,
  meterId,
  onHide,
  refreshKey = 0,
  onChanged,
}) {
  return (
    <Modal show={show} onHide={onHide} size="xl" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>Alarms — {meterId || 'Meter'}</Modal.Title>
      </Modal.Header>
      <Modal.Body className={styles.body}>
        <EnergyMeterActiveAlarms
          meterId={meterId}
          refreshKey={refreshKey}
          onChanged={onChanged}
        />
        <EnergyMeterAlarmSettings
          meterId={meterId}
          refreshKey={refreshKey}
        />
        <EnergyMeterAlarmHistory
          meterId={meterId}
          refreshKey={refreshKey}
        />
      </Modal.Body>
    </Modal>
  );
}
