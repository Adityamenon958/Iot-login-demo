import React, { useCallback, useEffect, useState } from 'react';
import { Col, Row, Badge, Button, Spinner, Form } from 'react-bootstrap';
import { ArrowLeft, Zap } from 'lucide-react';
import axios from 'axios';
import styles from './EnergyOverview.module.css';
import mainStyles from './MainContent.module.css';
import { useBackgroundRefresh } from '../hooks/useBackgroundRefresh';
import EnergyKpiCards from '../components/energy/EnergyKpiCards';
import EnergyFleetChart from '../components/energy/EnergyFleetChart';
import EnergyMeterCard from '../components/energy/EnergyMeterCard';
import EnergyParameterTiles from '../components/energy/EnergyParameterTiles';
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
  const isMobile = useIsMobile();

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

  const handleSelectMeter = (meterId) => {
    setSelectedMeterId(meterId);
    setViewMode('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToFleet = () => {
    setViewMode('fleet');
    setSelectedMeterId(null);
    setDetailLatest(null);
    setDetailLogs([]);
    setSelectedLog(null);
  };

  const device = detailLatest?.device;
  const parameters = detailLatest?.parameters || [];
  const rawPayload = selectedLog?.rawPayload ?? detailLatest?.rawPayload;
  const parseStatus = selectedLog?.parseStatus ?? detailLatest?.parseStatus;
  const simDataHidden = !viewSettings.showSimulatorData;

  if (!isInitialized || settingsLoading) {
    return (
      <Col xs={12} md={9} lg={10} xl={10} className={mainStyles.main}>
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
          <Spinner animation="border" variant="primary" />
        </div>
      </Col>
    );
  }

  return (
    <Col xs={12} md={9} lg={10} xl={10} className={mainStyles.main}>
      <div className={styles.page}>
        <div className={styles.viewContainer}>
          {/* Fleet layer */}
          <div
            className={`${styles.fleetLayer} ${viewMode === 'fleet' ? styles.layerActive : ''}`}
          >
            <div className={styles.pageHeader}>
              <div>
                <h4 className={styles.pageTitle}>
                  <Zap size={22} className="me-2" />
                  Energy Overview
                </h4>
                <p className={styles.pageSubtitle}>
                  Fleet monitoring for all registered energy meters
                </p>
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
                  <small className="text-muted">
                    Last refreshed: {lastUpdated.toLocaleTimeString()}
                  </small>
                )}
              </div>
            </div>

            <EnergyKpiCards kpis={overview?.kpis} />
            <EnergyFleetChart refreshKey={dataRefreshKey} />

            <h6 className={styles.sectionTitle}>Energy Meters</h6>
            <Row className="g-3">
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
                  <Col key={meter.meterId} xs={12} md={6} lg={4}>
                    <EnergyMeterCard meter={meter} onSelect={handleSelectMeter} />
                  </Col>
                ))
              )}
            </Row>
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
              <ArrowLeft size={18} className="me-1" />
              Back to Fleet Overview
            </Button>

            {detailLoading && !detailLatest ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
              </div>
            ) : (
              <>
                <div className={styles.detailHeader}>
                  <div>
                    <h4 className={styles.detailTitle}>{selectedMeterId}</h4>
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
                  <Badge bg={detailLatest?.online ? 'success' : 'secondary'}>
                    {detailLatest?.online ? 'ONLINE' : 'OFFLINE'}
                  </Badge>
                </div>

                <EnergyParameterTiles
                  readings={detailLatest?.readings || {}}
                  parameters={parameters}
                />

                {isMobile ? (
                  <>
                    <EnergyDetailChart meterId={selectedMeterId} refreshKey={dataRefreshKey} />
                    <div className="mb-3">
                      <EnergyRawPayloadPanel
                        rawPayload={rawPayload}
                        parseStatus={parseStatus}
                        collapsible
                      />
                    </div>
                  </>
                ) : (
                  <Row className="g-3 mb-3">
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
