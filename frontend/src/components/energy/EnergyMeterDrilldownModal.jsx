import React from 'react';
import { Modal, Spinner } from 'react-bootstrap';
import styles from './EnergyMeterDrilldownModal.module.css';

export default function EnergyMeterDrilldownModal({
  show,
  title,
  subtitle,
  onHide,
  toolbar,
  summary,
  charts,
  insights,
  loading = false,
}) {
  return (
    <Modal show={show} onHide={onHide} size="xl" fullscreen="md-down" centered>
      <Modal.Header closeButton>
        <div>
          <Modal.Title>{title}</Modal.Title>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>
      </Modal.Header>
      <Modal.Body className={styles.body}>
        {toolbar && <div className={styles.toolbar}>{toolbar}</div>}

        {loading ? (
          <div className={styles.loading}>
            <Spinner animation="border" size="sm" variant="primary" className="me-2" />
            Loading insights…
          </div>
        ) : (
          <>
            {summary && (
              <section className={styles.section}>
                <h6 className={styles.sectionTitle}>Summary</h6>
                {summary}
              </section>
            )}

            {charts && (
              <section className={styles.section}>
                <h6 className={styles.sectionTitle}>Charts</h6>
                {charts}
              </section>
            )}

            {insights && (
              <section className={styles.section}>
                {insights}
              </section>
            )}
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}
