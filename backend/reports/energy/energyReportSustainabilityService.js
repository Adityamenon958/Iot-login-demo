const { roundTo } = require('../../utils/meterInsightsUtils');

function buildSustainabilitySection(totalEnergyKwh, config) {
  const cfg = config.sustainability;
  if (!cfg.enabled || cfg.emissionFactorKgCo2PerKwh == null || !Number.isFinite(cfg.emissionFactorKgCo2PerKwh)) {
    return null;
  }

  const estimatedCo2Kg = roundTo(totalEnergyKwh * cfg.emissionFactorKgCo2PerKwh, 2);
  const estimatedCo2Tonnes = roundTo(estimatedCo2Kg / 1000, 2);

  return {
    visible: true,
    totalEnergyKwh,
    emissionFactorKgCo2PerKwh: cfg.emissionFactorKgCo2PerKwh,
    estimatedCo2Kg,
    estimatedCo2Tonnes,
    esgNote: cfg.esgPlaceholder
      ? 'Detailed ESG reporting and scope categorization will be available in a future release.'
      : null,
  };
}

module.exports = { buildSustainabilitySection };
