const { roundTo } = require('../../utils/meterInsightsUtils');

function buildCostSection(totalEnergyKwh, config) {
  const cfg = config.tariff;
  if (!cfg.enabled || cfg.ratePerKwh == null || !Number.isFinite(cfg.ratePerKwh)) {
    return null;
  }

  let estimatedCost = totalEnergyKwh * cfg.ratePerKwh;

  if (cfg.slabs?.length) {
    let remaining = totalEnergyKwh;
    estimatedCost = 0;
    let prevUpto = 0;
    const sorted = [...cfg.slabs].sort((a, b) => a.uptoKwh - b.uptoKwh);
    sorted.forEach((slab) => {
      const band = Math.min(remaining, slab.uptoKwh - prevUpto);
      if (band > 0) {
        estimatedCost += band * slab.rate;
        remaining -= band;
        prevUpto = slab.uptoKwh;
      }
    });
    if (remaining > 0 && sorted.length) {
      estimatedCost += remaining * sorted[sorted.length - 1].rate;
    }
  }

  return {
    visible: true,
    currency: cfg.currency || 'INR',
    totalEnergyKwh,
    ratePerKwh: cfg.ratePerKwh,
    estimatedCost: roundTo(estimatedCost, 2),
    tariffType: cfg.slabs?.length ? 'slab' : 'flat',
  };
}

module.exports = { buildCostSection };
