const { v4: uuidv4 } = require('uuid');
const EnergyReport = require('../../models/EnergyReport');
const { resolveReportPeriod, validateReportRequest } = require('./reportPeriodResolver');
const { getReportConfig } = require('./reportConfigService');
const { aggregateReportData } = require('./energyReportAggregationService');
const { aggregateAlarmData } = require('./energyReportAlarmService');
const { computeEnergyHealthScore } = require('./energyReportHealthScoreService');
const { buildExecutiveSummary } = require('./energyReportExecutiveSummaryService');
const { buildRankings } = require('./energyReportRankingsService');
const { buildRecommendations } = require('./energyReportRecommendationsService');
const { buildSustainabilitySection } = require('./energyReportSustainabilityService');
const { buildCostSection } = require('./energyReportCostService');
const { buildReportCharts } = require('./energyReportChartService');
const { renderReport } = require('./energyReportRenderService');
const { LARGE_FLEET_ASYNC_THRESHOLD } = require('./reportTypes');

function getGeneratedByDisplayName(user = {}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return (
    user.name
    || user.displayName
    || fullName
    || user.username
    || user.email
    || 'User'
  );
}

async function buildReportPayload(meters, request, user, companyName) {
  const period = resolveReportPeriod(request.reportType, request.periodPreset);
  const config = getReportConfig(companyName);

  const agg = await aggregateReportData(meters, period);
  const alarms = await aggregateAlarmData(meters, period, agg.meters);

  agg.fleetSummary.alarmCounts = {
    total: alarms.summary.total,
    critical: alarms.summary.critical,
    warning: alarms.summary.warning,
    active: alarms.summary.active,
    acknowledged: alarms.summary.acknowledged,
    cleared: alarms.summary.cleared,
  };

  const energyHealth = computeEnergyHealthScore(
    agg.fleetSummary,
    agg.meters,
    alarms,
    period.periodDays,
    config
  );

  const sustainability = buildSustainabilitySection(agg.fleetSummary.totalEnergyKwh, config);
  const cost = buildCostSection(agg.fleetSummary.totalEnergyKwh, config);

  const rankings = buildRankings(agg.meters, agg.fleetSummary.totalEnergyKwh);
  const recommendations = buildRecommendations(
    agg.fleetSummary,
    agg.meters,
    alarms,
    period.periodDays,
    config
  );

  const partialPayload = {
    meta: {
      reportId: uuidv4(),
      companyName,
      generatedBy: getGeneratedByDisplayName(user),
      generatedAt: new Date(),
      reportType: request.reportType,
      periodPreset: request.periodPreset,
      periodLabel: period.periodLabel,
      from: period.from,
      to: period.to,
      timezone: period.timezone,
      scope: request.scope,
      meterCount: meters.length,
      reportingMeterCount: agg.meters.filter((m) => m.totalEnergyKwh > 0).length,
      format: request.format,
      version: '1.0',
    },
    fleetSummary: agg.fleetSummary,
    comparisons: agg.comparisons,
    energyHealth,
    sustainability,
    cost,
    rankings,
    recommendations,
    meters: agg.meters,
    alarms,
    dailyBreakdown: agg.dailyBreakdown,
    energyByMeter: agg.energyByMeter,
    trendSeries: agg.trendSeries,
    loadProfile: agg.loadProfile,
  };

  partialPayload.executiveSummary = buildExecutiveSummary({
    period,
    fleetSummary: agg.fleetSummary,
    comparisons: agg.comparisons,
    energyHealth,
    alarms,
    energyByMeter: agg.energyByMeter,
    sustainability,
    cost,
  });

  partialPayload.charts = await buildReportCharts({
    dailyBreakdown: agg.dailyBreakdown,
    trendSeries: agg.trendSeries,
    loadProfile: agg.loadProfile,
    energyByMeter: agg.energyByMeter,
    alarms,
  });

  return partialPayload;
}

async function generateEnergyReport(meters, body, user, companyName) {
  const request = validateReportRequest(body);
  const startMs = Date.now();

  if (meters.length > LARGE_FLEET_ASYNC_THRESHOLD) {
    throw Object.assign(
      new Error(`Fleet size (${meters.length}) exceeds synchronous limit. Async generation coming in a future update.`),
      { statusCode: 503 }
    );
  }

  const payload = await buildReportPayload(meters, request, user, companyName);
  const pdfBuffer = await renderReport(payload, request.format);
  const durationMs = Date.now() - startMs;

  const fileName = `energy-report-${request.reportType}-${request.periodPreset}-${payload.meta.reportId.slice(0, 8)}.pdf`;

  await EnergyReport.create({
    reportId: payload.meta.reportId,
    companyName,
    generatedBy: {
      userId: user.id || user._id,
      name: getGeneratedByDisplayName(user),
      email: user.email,
    },
    scope: request.scope,
    reportType: request.reportType,
    periodPreset: request.periodPreset,
    periodLabel: payload.meta.periodLabel,
    from: payload.meta.from,
    to: payload.meta.to,
    format: request.format,
    status: 'completed',
    energyHealthScore: payload.energyHealth.score,
    meterCount: meters.length,
    generationDurationMs: durationMs,
    fileName,
    completedAt: new Date(),
  });

  return { payload, pdfBuffer, fileName, reportId: payload.meta.reportId, durationMs };
}

async function listReportHistory(companyName, limit = 20) {
  return EnergyReport.find({ companyName })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-__v')
    .lean();
}

module.exports = { generateEnergyReport, buildReportPayload, listReportHistory };
