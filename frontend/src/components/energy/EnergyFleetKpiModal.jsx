import React from 'react';
import { getFleetKpiConfig } from './fleetKpiConfig';
import EnergyFleetConsumptionDrilldown from './EnergyFleetConsumptionDrilldown';
import EnergyFleetMetricDrilldown from './EnergyFleetMetricDrilldown';

export default function EnergyFleetKpiModal({
  show,
  kpiKey,
  onHide,
  refreshKey = 0,
}) {
  const config = getFleetKpiConfig(kpiKey);
  if (!config || !kpiKey) return null;

  if (config.type === 'consumption') {
    return (
      <EnergyFleetConsumptionDrilldown
        show={show}
        kpiKey={kpiKey}
        onHide={onHide}
        refreshKey={refreshKey}
      />
    );
  }

  return (
    <EnergyFleetMetricDrilldown
      show={show}
      kpiKey={kpiKey}
      onHide={onHide}
      refreshKey={refreshKey}
    />
  );
}
