function formatKwh(value) {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  return `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kWh`;
}

function formatPct(delta) {
  if (delta == null) return '';
  const sign = delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'unchanged';
  if (delta === 0) return 'unchanged from the previous period';
  return `${sign} by ${Math.abs(delta)}% compared to the previous period`;
}

function pfLabel(avgPf) {
  if (avgPf == null) return 'unknown';
  if (avgPf >= 0.95) return 'excellent';
  if (avgPf >= 0.9) return 'good';
  if (avgPf >= 0.8) return 'needs attention';
  return 'poor';
}

function buildExecutiveSummary({
  period,
  fleetSummary,
  comparisons,
  energyHealth,
  alarms,
  energyByMeter,
  sustainability,
  cost,
}) {
  const paragraphs = [];
  const highlights = [];

  const totalKwh = fleetSummary.totalEnergyKwh;
  const deltaPct = comparisons?.previousPeriod?.totalEnergyKwh?.deltaPct;

  let energyLine = `During ${period.periodLabel}, the fleet consumed ${formatKwh(totalKwh)}.`;
  if (deltaPct != null) {
    energyLine += ` This is ${formatPct(deltaPct)}.`;
  }
  paragraphs.push(energyLine);

  if (fleetSummary.peakActivePowerKw != null) {
    const peakDate = fleetSummary.peakActivePowerAt
      ? new Date(fleetSummary.peakActivePowerAt).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : '';
    paragraphs.push(
      `Peak demand reached ${fleetSummary.peakActivePowerKw} kW${peakDate ? ` on ${peakDate}` : ''}.`
    );
    highlights.push({ label: 'Peak Demand', value: `${fleetSummary.peakActivePowerKw} kW` });
  }

  if (energyByMeter?.length) {
    const top = energyByMeter[0];
    paragraphs.push(
      `${top.meterId} was the highest energy consumer with ${formatKwh(top.kwh)} (${top.sharePct}% of fleet total).`
    );
    highlights.push({ label: 'Top Consumer', value: top.meterId });
  }

  if (fleetSummary.avgPowerFactor != null) {
    paragraphs.push(
      `Average fleet power factor was ${fleetSummary.avgPowerFactor} (${pfLabel(fleetSummary.avgPowerFactor)}).`
    );
    highlights.push({ label: 'Avg Power Factor', value: String(fleetSummary.avgPowerFactor) });
  }

  const alarmTotal = alarms?.summary?.total || 0;
  const critical = alarms?.summary?.critical || 0;
  const warning = alarms?.summary?.warning || 0;
  const active = alarms?.summary?.active || 0;
  paragraphs.push(
    alarmTotal === 0
      ? 'No alarms were triggered during this period.'
      : `${alarmTotal} alarm(s) were triggered (${critical} critical, ${warning} warning). ${active} remain open.`
  );
  highlights.push({ label: 'Alarms Triggered', value: String(alarmTotal) });

  paragraphs.push(
    `Overall fleet health is rated ${energyHealth.label} (${energyHealth.score}/100). ` +
      `${fleetSummary.onlineMeters} of ${fleetSummary.onlineMeters + fleetSummary.offlineMeters} meters are currently online.`
  );
  highlights.push({ label: 'Health Score', value: `${energyHealth.score}/100` });

  if (sustainability?.visible) {
    paragraphs.push(
      `Estimated CO₂ emissions: ${sustainability.estimatedCo2Tonnes} tonnes ` +
        `(factor: ${sustainability.emissionFactorKgCo2PerKwh} kg/kWh).`
    );
  }

  if (cost?.visible) {
    paragraphs.push(
      `Estimated energy cost: ${cost.currency} ${cost.estimatedCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}.`
    );
  }

  highlights.unshift({ label: 'Total Energy', value: formatKwh(totalKwh) });

  return { paragraphs, highlights };
}

module.exports = { buildExecutiveSummary };
