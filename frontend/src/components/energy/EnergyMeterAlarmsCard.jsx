import React from 'react';
import { Card } from 'react-bootstrap';
import { Bell } from 'lucide-react';
import EnergyMeterActiveAlarms from './EnergyMeterActiveAlarms';
import EnergyMeterAlarmSettings from './EnergyMeterAlarmSettings';
import EnergyMeterAlarmHistory from './EnergyMeterAlarmHistory';
import styles from './EnergyMeterAlarmsCard.module.css';

export default function EnergyMeterAlarmsCard({ meterId, refreshKey = 0, onChanged }) {
  return (
    <Card className={styles.card}>
      <Card.Header className={styles.header}>
        <div className={styles.titleRow}>
          <Bell size={18} />
          <span>Alarms</span>
        </div>
      </Card.Header>
      <Card.Body className={styles.body}>
        <EnergyMeterActiveAlarms
          meterId={meterId}
          refreshKey={refreshKey}
          onChanged={onChanged}
          embedded
        />
        <EnergyMeterAlarmSettings
          meterId={meterId}
          refreshKey={refreshKey}
          embedded
        />
        <EnergyMeterAlarmHistory
          meterId={meterId}
          refreshKey={refreshKey}
          embedded
        />
      </Card.Body>
    </Card>
  );
}
