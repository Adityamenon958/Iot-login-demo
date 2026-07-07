import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Alert, Spinner } from 'react-bootstrap';
import { CalendarRange, FileText, Users } from 'lucide-react';
import axios from 'axios';
import {
  REPORT_TYPES,
  OUTPUT_FORMATS,
  getPeriodOptions,
  getDefaultPeriodPreset,
} from './reportConfig';
import { generateAndDownloadReport } from '../../services/energyReportApi';
import { getUserDisplayName } from '../../lib/userUtils';
import { formatReportPeriodRange } from '../../utils/reportPeriodUtils';
import styles from './EnergyReportModal.module.css';

const PROGRESS_STEPS = [
  'Collecting fleet data…',
  'Computing health score…',
  'Building charts…',
  'Generating PDF…',
];

export default function EnergyReportModal({ show, onHide, meterCount = 0, onGenerated }) {
  const [reportType, setReportType] = useState('weekly');
  const [periodPreset, setPeriodPreset] = useState('last_week');
  const [format, setFormat] = useState('pdf');
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userInfo, setUserInfo] = useState(null);

  const periodOptions = useMemo(() => getPeriodOptions(reportType), [reportType]);

  useEffect(() => {
    if (!show) return;
    setError('');
    setSuccess('');
    setProgressStep(0);
    axios.get('/api/auth/userinfo', { withCredentials: true })
      .then((res) => setUserInfo(res.data))
      .catch(() => setUserInfo(null));
  }, [show]);

  useEffect(() => {
    setPeriodPreset(getDefaultPeriodPreset(reportType));
  }, [reportType]);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    setProgressStep(0);

    const stepTimer = setInterval(() => {
      setProgressStep((s) => Math.min(s + 1, PROGRESS_STEPS.length - 1));
    }, 1200);

    try {
      const result = await generateAndDownloadReport({
        reportType,
        periodPreset,
        format,
        scope: 'fleet',
      });
      setSuccess(`Report downloaded: ${result.fileName}`);
      onGenerated?.(result);
    } catch (err) {
      let message = 'Report generation failed. Please try again.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          message = parsed.error || message;
        } catch {
          // keep default
        }
      } else if (err.response?.data?.error) {
        message = err.response.data.error;
      }
      setError(message);
    } finally {
      clearInterval(stepTimer);
      setLoading(false);
      setProgressStep(0);
    }
  };

  const typeLabel = REPORT_TYPES.find((t) => t.key === reportType)?.label;
  const periodLabel = periodOptions.find((p) => p.key === periodPreset)?.label;
  const dateRangeLabel = useMemo(
    () => formatReportPeriodRange(periodPreset),
    [periodPreset]
  );

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      backdrop={loading ? 'static' : true}
      dialogClassName={styles.modalDialog}
      contentClassName={styles.modalContent}
    >
      <Modal.Header closeButton={!loading} className={styles.modalHeader}>
        <div className="w-100">
          <h4 className={styles.modalTitle}>Generate Energy Report</h4>
          <p className={styles.modalSubtitle}>
            Fleet PDF · consumption, health &amp; alarms
          </p>
        </div>
      </Modal.Header>

      <Modal.Body className={styles.modalBody}>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')} className={styles.compactAlert}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" dismissible onClose={() => setSuccess('')} className={styles.compactAlert}>
            {success}
          </Alert>
        )}

        <div className={styles.previewCard}>
          <div className={styles.previewTop}>
            <div className={styles.previewCompany}>
              {userInfo?.companyName || 'Your company'}
            </div>
            {userInfo && (
              <div className={styles.previewAuthor}>
                {getUserDisplayName(userInfo)}
              </div>
            )}
          </div>

          <div className={styles.previewChips}>
            <span className={styles.chip}>
              <FileText size={10} />
              {typeLabel}
            </span>
            <span className={styles.chip}>
              <CalendarRange size={10} />
              {periodLabel}
            </span>
            <span className={styles.chip}>
              <Users size={10} />
              {meterCount} meter{meterCount !== 1 ? 's' : ''}
            </span>
          </div>

          <div className={styles.dateRangeRow}>
            <CalendarRange size={13} className={styles.dateRangeIcon} />
            <div className={styles.dateRangeValue}>{dateRangeLabel}</div>
          </div>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Report type</span>
            <div className={styles.segmentGroup} role="radiogroup" aria-label="Report type">
              {REPORT_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={reportType === t.key}
                  className={`${styles.segment} ${reportType === t.key ? styles.segmentActive : ''}`}
                  onClick={() => setReportType(t.key)}
                  disabled={loading}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionLabel}>Report period</span>
            <div className={styles.segmentGroup} role="radiogroup" aria-label="Report period">
              {periodOptions.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  role="radio"
                  aria-checked={periodPreset === p.key}
                  className={`${styles.segment} ${periodPreset === p.key ? styles.segmentActive : ''}`}
                  onClick={() => setPeriodPreset(p.key)}
                  disabled={loading}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <span className={styles.sectionLabel}>Output format</span>
            <div className={styles.segmentGroup} role="radiogroup" aria-label="Output format">
              {OUTPUT_FORMATS.map((f) => {
                const isActive = format === f.key;
                const isDisabled = loading || !f.enabled;
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    className={[
                      styles.segment,
                      styles.segmentCompact,
                      isActive ? styles.segmentActive : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => f.enabled && setFormat(f.key)}
                    disabled={isDisabled}
                    title={!f.enabled ? f.hint : undefined}
                  >
                    {f.enabled ? f.label : `${f.label} · Soon`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {meterCount === 0 && (
          <div className={styles.emptyFleetNote}>
            No meters found in your fleet. Add meters before generating a report.
          </div>
        )}

        {loading && (
          <div className={styles.progressBox}>
            <Spinner size="sm" />
            <span>{PROGRESS_STEPS[progressStep]}</span>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer className={styles.modalFooter}>
        <Button
          variant="outline-secondary"
          onClick={onHide}
          disabled={loading}
          className={styles.cancelBtn}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={loading || meterCount === 0}
          className={styles.generateBtn}
        >
          {loading ? (
            <>
              <Spinner size="sm" className="me-2" />
              Generating…
            </>
          ) : (
            'Generate Report'
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
