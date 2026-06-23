import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Col, Row, Badge, Button, Spinner, Form } from 'react-bootstrap';
import { ArrowLeft, Zap } from 'lucide-react';
import axios from 'axios';
import styles from './EnergyOverview.module.css';
import mainStyles from './MainContent.module.css';
import { useBackgroundRefresh } from '../hooks/useBackgroundRefresh';
import EnergyKpiCards from '../components/energy/EnergyKpiCards';
import EnergyFleetKpiModal from '../components/energy/EnergyFleetKpiModal';
import EnergyFleetChart from '../components/energy/EnergyFleetChart';
import EnergyFleetMetersTable from '../components/energy/EnergyFleetMetersTable';
import EnergyElectricalHealth from '../components/energy/EnergyElectricalHealth';
import EnergyMeterCard from '../components/energy/EnergyMeterCard';
import EnergyParameterTiles from '../components/energy/EnergyParameterTiles';
import EnergyMeterParameterModal from '../components/energy/EnergyMeterParameterModal';
import EnergyDetailChart from '../components/energy/EnergyDetailChart';
import EnergyLogsTable from '../components/energy/EnergyLogsTable';
import EnergyRawPayloadPanel from '../components/energy/EnergyRawPayloadPanel';

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mobile;
}

export default function EnergyOverview() {
  const [viewMode, setViewMode] = useState('fleet');
  const [selectedMeterId, setSelectedMeterId] = useState(null);
  const [detailLatest, setDetailLatest] = useState(null);
  const [detailLogs, setDetailLogs] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [viewSettings, setViewSettings] = useState({
    showSimulatorData: true,
    canEdit: false,
    simulatorMeterCount: 0,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [selectedParameterKey, setSelectedParameterKey] = useState(null);
  const [selectedFleetKpiKey, setSelectedFleetKpiKey] = useState(null);
  const isMobile = useIsMobile();
  const mainScrollRef = useRef(null);

  const scrollMainToTop = useCallback((behavior = 'auto') => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior });
  }, []);

  const fetchOverview = useCallback(async () => {
    const res = await axios.get('/api/energy-meter/overview', { withCredentials: true });
    return res.data;
  }, []);

  const { data: overview, lastUpdated, isInitialized, manualRefresh } = useBackgroundRefresh(
    fetchOverview,
    30000
  );

  const loadViewSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const res = await axios.get('/api/energy-meter/view-settings', { withCredentials: true });
      setViewSettings({
        showSimulatorData: res.data.showSimulatorData !== false,
        canEdit: res.data.canEdit === true,
        simulatorMeterCount: res.data.simulatorMeterCount || 0,
      });
    } catch (err) {
      console.error('Failed to load view settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadViewSettings();
  }, [loadViewSettings]);

  const handleSimulatorToggle = async (e) => {
    const showSimulatorData = e.target.checked;
    if (!viewSettings.canEdit) return;

    try {
      setSavingSettings(true);
      await axios.put(
        '/api/energy-meter/view-settings',
        { showSimulatorData },
        { withCredentials: true }
      );
      setViewSettings((prev) => ({ ...prev, showSimulatorData }));
      setDataRefreshKey((k) => k + 1);
      await manualRefresh();
      if (viewMode === 'detail' && selectedMeterId) {
        await fetchDetail(selectedMeterId);
      }
    } catch (err) {
      console.error('Failed to update view settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchDetail = useCallback(async (meterId) => {
    if (!meterId) return;
    setDetailLoading(true);
    try {
      const [latestRes, logsRes] = await Promise.all([
        axios.get('/api/energy-meter/latest', {
          params: { meterId },
          withCredentials: true,
        }),
        axios.get('/api/energy-meter/logs', {
          params: { meterId, limit: 50 },
          withCredentials: true,
        }),
      ]);
      setDetailLatest(latestRes.data);
      setDetailLogs(logsRes.data.logs || []);
      setSelectedLog(latestRes.data);
    } catch (err) {
      console.error('Detail fetch failed:', err);
      setDetailLatest(null);
      setDetailLogs([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'detail' && selectedMeterId) {
      fetchDetail(selectedMeterId);
      const interval = setInterval(() => fetchDetail(selectedMeterId), 30000);
      return () => clearInterval(interval);
    }
  }, [viewMode, selectedMeterId, fetchDetail]);

  useEffect(() => {
    if (viewMode === 'detail' && selectedMeterId) {
      scrollMainToTop('auto');
    }
  }, [viewMode, selectedMeterId, scrollMainToTop]);

  useEffect(() => {
    if (viewMode === 'detail' && detailLatest && !detailLoading) {
      scrollMainToTop('auto');
    }
  }, [viewMode, detailLatest, detailLoading, scrollMainToTop]);

  const handleSelectMeter = (meterId) => {
    setSelectedMeterId(meterId);
    setViewMode('detail');
    scrollMainToTop('auto');
  };

  const handleBackToFleet = () => {
    setViewMode('fleet');
    setSelectedMeterId(null);
    setSelectedParameterKey(null);
    setDetailLatest(null);
    setDetailLogs([]);
    setSelectedLog(null);
    scrollMainToTop('auto');
  };

  const device = detailLatest?.device;
  const parameters = detailLatest?.parameters || [];
  const rawPayload = selectedLog?.rawPayload ?? detailLatest?.rawPayload;
  const parseStatus = selectedLog?.parseStatus ?? detailLatest?.parseStatus;
  const simDataHidden = !viewSettings.showSimulatorData;

  if (!isInitialized || settingsLoading) {
    return (
      <Col
        ref={mainScrollRef}
        xs={12}
        md={9}
        lg={10}
        xl={10}
        className={mainStyles.main}
      >
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
          <Spinner animation="border" variant="primary" />
        </div>
      </Col>
    );
  }

  return (
    <Col
      ref={mainScrollRef}
      xs={12}
      md={9}
      lg={10}
      xl={10}
      className={mainStyles.main}
    >
      <div className={styles.page}>
        <div className={styles.viewContainer}>
          {/* Fleet layer */}
          <div
            className={`${styles.fleetLayer} ${viewMode === 'fleet' ? styles.layerActive : ''}`}
          >
            <div className={styles.pageHeader}>
              <div>
                <h5 className={styles.pageTitle}>
                  <Zap size={18} className="me-2" />
                  Energy Overview
                </h5>
                <p className={styles.pageSubtitle}>
                  Fleet monitoring for all registered energy meters
                </p>
                {overview?.kpis && (
                  <div className={styles.fleetSummary}>
                    <span>
                      Total Meters:{' '}
                      <strong>{overview.kpis.totalMeters ?? 0}</strong>
                    </span>
                    <span className={styles.summarySep} aria-hidden="true">·</span>
                    <span>
                      Online:{' '}
                      <strong className={styles.summaryOnline}>
                        {overview.kpis.onlineMeters ?? 0}
                      </strong>
                    </span>
                    <span className={styles.summarySep} aria-hidden="true">·</span>
                    <span>
                      Offline:{' '}
                      <strong className={styles.summaryOffline}>
                        {overview.kpis.offlineMeters ?? 0}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
              <div className={styles.headerMeta}>
                {viewSettings.canEdit && (
                  <Form.Check
                    type="switch"
                    id="show-simulator-data"
                    className={styles.simToggle}
                    label="Show simulator data"
                    checked={viewSettings.showSimulatorData}
                    disabled={savingSettings}
                    onChange={handleSimulatorToggle}
                  />
                )}
                {simDataHidden && (
                  <Badge bg="secondary" className={styles.hiddenBadge}>Demo data hidden</Badge>
                )}
                <Badge bg="success" className={styles.liveBadge}>LIVE</Badge>
                {lastUpdated && (
                  <small className={`text-muted ${styles.lastRefreshed}`}>
                    Last refreshed: {lastUpdated.toLocaleTimeString()}
                  </small>
                )}
              </div>
            </div>

            <EnergyKpiCards
              kpis={overview?.kpis}
              onKpiClick={setSelectedFleetKpiKey}
            />

            <EnergyFleetKpiModal
              show={Boolean(selectedFleetKpiKey)}
              kpiKey={selectedFleetKpiKey}
              onHide={() => setSelectedFleetKpiKey(null)}
              refreshKey={dataRefreshKey}
            />
            <EnergyFleetChart refreshKey={dataRefreshKey} />
            <EnergyElectricalHealth refreshKey={dataRefreshKey} />

            <h6 className={styles.sectionTitle}>Energy Meters</h6>
            <Row className="g-2">
              {(overview?.meters || []).length === 0 ? (
                <Col xs={12}>
                  <div className={styles.emptyState}>
                    {simDataHidden
                      ? 'No live meter data. Simulator data is hidden.'
                      : (
                        <>
                          No energy meters registered. Add devices with type{' '}
                          <code>energyMeter</code> or run the seed script.
                        </>
                      )}
                  </div>
                </Col>
              ) : (
                overview.meters.map((meter) => (
                  <Col key={meter.meterId} xs={12} md={6} lg={3} xl={3}>
                    <EnergyMeterCard meter={meter} onSelect={handleSelectMeter} />
                  </Col>
                ))
              )}
            </Row>

            <EnergyFleetMetersTable
              refreshKey={dataRefreshKey}
              onSelectMeter={handleSelectMeter}
              simDataHidden={simDataHidden}
            />
          </div>

          {/* Detail layer */}
          <div
            className={`${styles.detailLayer} ${viewMode === 'detail' ? styles.layerActive : ''}`}
          >
            <Button
              variant="link"
              className={styles.backBtn}
              onClick={handleBackToFleet}
            >
              <ArrowLeft size={16} className="me-1" />
              Back to Fleet Overview
            </Button>

            {detailLoading && !detailLatest ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
              </div>
            ) : (
              <>
                <div className={styles.detailHeader}>
                  <div className={styles.detailTitleRow}>
                    <h4 className={styles.detailTitle}>{selectedMeterId}</h4>
                    <Badge bg={detailLatest?.online ? 'success' : 'secondary'}>
                      {detailLatest?.online ? 'ONLINE' : 'OFFLINE'}
                    </Badge>
                  </div>
                  <div className={styles.breadcrumb}>
                    {[device?.siteName, device?.plantName, device?.machineName]
                      .filter(Boolean)
                      .join(' > ')}
                  </div>
                  <small className="text-muted">
                    UID: {device?.uid || '—'}
                    {detailLatest?.timestamp && (
                      <> | Last reading: {new Date(detailLatest.timestamp).toLocaleString()}</>
                    )}
                  </small>
                </div>

                <EnergyParameterTiles
                  readings={detailLatest?.readings || {}}
                  parameters={parameters}
                  parameterStats24h={detailLatest?.parameterStats24h}
                  onParameterClick={setSelectedParameterKey}
                />

                <EnergyMeterParameterModal
                  show={Boolean(selectedParameterKey)}
                  parameterKey={selectedParameterKey}
                  meterId={selectedMeterId}
                  onHide={() => setSelectedParameterKey(null)}
                  refreshKey={dataRefreshKey}
                />

                {isMobile ? (
                  <>
                    <EnergyDetailChart meterId={selectedMeterId} refreshKey={dataRefreshKey} />
                    <div className="mb-2">
                      <EnergyRawPayloadPanel
                        rawPayload={rawPayload}
                        parseStatus={parseStatus}
                        collapsible
                      />
                    </div>
                  </>
                ) : (
                  <Row className="g-2 mb-2">
                    <Col lg={8}>
                      <EnergyDetailChart meterId={selectedMeterId} refreshKey={dataRefreshKey} />
                    </Col>
                    <Col lg={4}>
                      <EnergyRawPayloadPanel
                        rawPayload={rawPayload}
                        parseStatus={parseStatus}
                      />
                    </Col>
                  </Row>
                )}

                <EnergyLogsTable
                  logs={detailLogs}
                  selectedLogId={selectedLog?._id}
                  onSelectLog={setSelectedLog}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </Col>
  );
}
