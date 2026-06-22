import React from 'react';
import { getParameterDrilldown } from './meterParameterConfig';
import EnergyConsumptionDrilldown from './EnergyConsumptionDrilldown';
import EnergyMetricDrilldown from './EnergyMetricDrilldown';

export default function EnergyMeterParameterModal({
  show,
  parameterKey,
  meterId,
  onHide,
  refreshKey = 0,
}) {
  const config = getParameterDrilldown(parameterKey);
  if (!config || !parameterKey) return null;

  if (config.type === 'consumption') {
    return (
      <EnergyConsumptionDrilldown
        show={show}
        meterId={meterId}
        onHide={onHide}
        refreshKey={refreshKey}
      />
    );
  }

  return (
    <EnergyMetricDrilldown
      show={show}
      meterId={meterId}
      parameterKey={parameterKey}
      onHide={onHide}
      refreshKey={refreshKey}
    />
  );
}
