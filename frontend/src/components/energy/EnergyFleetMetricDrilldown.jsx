import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import EnergyMeterDrilldownModal from './EnergyMeterDrilldownModal';
import EnergyChartRangePills from './EnergyChartRangePills';
import EnergyInsightStatGrid from './EnergyInsightStatGrid';
import EnergyInsightsPanel from './EnergyInsightsPanel';
import EnergyMultiLineChart from './EnergyMultiLineChart';
import EnergyFleetSnapshot from './EnergyFleetSnapshot';
import EnergyFleetMeterRanking from './EnergyFleetMeterRanking';
import { CHART_RANGES, buildChartSubtitle } from './energyChartShared';
import {
  getFleetKpiConfig,
  getFleetRankingKeys,
  RANKING_LABELS,
} from './fleetKpiConfig';

function healthScoreVariant(score) {
  if (score == null) return null;
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'warning';
  return 'critical';
}

function buildActivePowerSummary(summary) {
  const items = [
    {
      key: 'fleetPower',
      label: 'Current Fleet Power',
      value: summary.fleetCurrentPower,
      unit: 'kW',
    },
  ];
  if (summary.topConsumerRightNow) {
    items.push({
      key: 'topNow',
      label: 'Top Consumer Right Now',
      value: summary.topConsumerRightNow.value,
      unit: 'kW',
      sublabel: summary.topConsumerRightNow.name,
    });
  }
  if (summary.topConsumerToday) {
    items.push({
      key: 'topToday',
      label: 'Top Consumer Today',
      value: summary.topConsumerToday.value,
      unit: 'kWh',
      sublabel: summary.topConsumerToday.name,
    });
  }
  items.push(
    {
      key: 'peak',
      label: 'Peak Fleet Power Today',
      value: summary.peakFleetPowerToday,
      unit: 'kW',
    },
    {
      key: 'avg',
      label: 'Average Fleet Power',
      value: summary.averageFleetPower,
      unit: 'kW',
    },
    {
      key: 'active',
      label: 'Active Meter Count',
      value: summary.activeMeterCount,
      unit: '',
      decimals: 0,
    },
    {
      key: 'lf',
      label: 'Fleet Load Factor',
      value: summary.fleetLoadFactor != null ? Math.round(summary.fleetLoadFactor * 100) : null,
      unit: '%',
      decimals: 0,
    }
  );
  return items;
}

function buildPfSummary(summary) {
  return [
    { key: 'avg', label: 'Fleet Avg PF', value: summary.fleetAveragePf, unit: '', decimals: 2 },
    {
      key: 'health',
      label: 'Fleet Health Score',
      value: summary.healthScore,
      unit: '/100',
      decimals: 0,
      sublabel: healthScoreVariant(summary.healthScore),
    },
    { key: 'min', label: 'Fleet Min PF', value: summary.fleetMinPf, unit: '', decimals: 2 },
    { key: 'max', label: 'Fleet Max PF', value: summary.fleetMaxPf, unit: '', decimals: 2 },
    {
      key: 'compliance',
      label: 'PF Compliance',
      value: summary.fleetPfCompliancePercent,
      unit: '%',
      decimals: 1,
    },
    {
      key: 'below',
      label: 'Meters Below 0.90',
      value: summary.metersBelowThreshold,
      unit: '',
      decimals: 0,
    },
  ];
}

function buildVoltageSummary(summary) {
  return [
    {
      key: 'avg',
      label: 'Fleet Avg Voltage',
      value: summary.fleetAverageVoltage,
      unit: 'V',
      decimals: 1,
    },
    {
      key: 'health',
      label: 'Fleet Health Score',
      value: summary.healthScore,
      unit: '/100',
      decimals: 0,
    },
    {
      key: 'min',
      label: 'Fleet Min Voltage',
      value: summary.fleetMinVoltage,
      unit: 'V',
      decimals: 1,
    },
    {
      key: 'max',
      label: 'Fleet Max Voltage',
      value: summary.fleetMaxVoltage,
      unit: 'V',
      decimals: 1,
    },
    {
      key: 'variation',
      label: 'Max Variation',
      value: summary.fleetVoltageVariation,
      unit: 'V',
      decimals: 1,
    },
    {
      key: 'tir',
      label: 'Time in Range',
      value: summary.timeInRangePercent,
      unit: '%',
      decimals: 1,
    },
  ];
}

function buildFrequencySummary(summary) {
  return [
    {
      key: 'avg',
      label: 'Fleet Avg Frequency',
      value: summary.fleetAverageFrequency,
      unit: 'Hz',
      decimals: 2,
    },
    {
      key: 'min',
      label: 'Fleet Min Frequency',
      value: summary.fleetMinFrequency,
      unit: 'Hz',
      decimals: 2,
    },
    {
      key: 'max',
      label: 'Fleet Max Frequency',
      value: summary.fleetMaxFrequency,
      unit: 'Hz',
      decimals: 2,
    },
    {
      key: 'health',
      label: 'Fleet Health Score',
      value: summary.healthScore,
      unit: '/100',
      decimals: 0,
    },
    {
      key: 'healthy',
      label: 'Healthy Band',
      value: summary.healthyBandPercent,
      unit: '%',
      decimals: 1,
    },
  ];
}

function buildInsightItems(metricKey, insights) {
  if (metricKey === 'activePower') {
    return [
      { key: 'peakAt', label: 'Peak Demand Time', type: 'timestamp', value: insights.peakDemandAt },
      { key: 'lowAt', label: 'Lowest Demand Time', type: 'timestamp', value: insights.lowestDemandAt },
      { key: 'runToday', label: 'Fleet Running Hours Today', value: insights.fleetRunningHoursToday, unit: 'hrs' },
      {
        key: 'runPeriod',
        label: 'Fleet Running Hours in Period',
        value: insights.fleetRunningHoursInPeriod,
        unit: 'hrs',
      },
    ];
  }
  if (metricKey === 'voltage') {
    return [
      { key: 'under', label: 'Undervoltage Events', value: insights.undervoltageEvents },
      { key: 'underAff', label: 'Affected Meters (Undervoltage)', value: insights.undervoltageAffectedMeters },
      { key: 'over', label: 'Overvoltage Events', value: insights.overvoltageEvents },
      { key: 'overAff', label: 'Affected Meters (Overvoltage)', value: insights.overvoltageAffectedMeters },
    ];
  }
  if (metricKey === 'powerFactor') {
    return [
      { key: 'low', label: 'Low Penalty Risk Meters', value: insights.penaltyRiskLow },
      { key: 'med', label: 'Medium Penalty Risk Meters', value: insights.penaltyRiskMedium },
      { key: 'high', label: 'High Penalty Risk Meters', value: insights.penaltyRiskHigh },
    ];
  }
  if (metricKey === 'frequency') {
    return [{ key: 'oob', label: 'Out-of-Band Events', value: insights.outOfBandEventCount }];
  }
  return [];
}

export default function EnergyFleetMetricDrilldown({
  show,
  kpiKey,
  onHide,
  refreshKey = 0,
}) {
  const config = getFleetKpiConfig(kpiKey);
  const metricKey = config?.metricKey;
  const [range, setRange] = useState('24h');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!metricKey) return;
    setLoading(true);
    try {
      const res = await axios.get('/api/energy-meter/fleet-metric-insights', {
        params: { metric: metricKey, range },
        withCredentials: true,
      });
      setData(res.data);
    } catch (err) {
      console.error('Fleet metric insights fetch failed:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [metricKey, range]);

  useEffect(() => {
    if (show && metricKey) fetchInsights();
  }, [show, metricKey, fetchInsights, refreshKey]);

  const summary = data?.summary || {};
  const insights = data?.insights || {};
  const rankings = data?.rankings || {};
  const chartSeries = data?.charts?.chartSeries || [];
  const visibleMeters = useMemo(
    () => new Set(chartSeries.map((s) => s.meterId)),
    [chartSeries]
  );

  const summaryItems = useMemo(() => {
    if (metricKey === 'activePower') return buildActivePowerSummary(summary);
    if (metricKey === 'powerFactor') return buildPfSummary(summary);
    if (metricKey === 'voltage') return buildVoltageSummary(summary);
    if (metricKey === 'frequency') return buildFrequencySummary(summary);
    return [];
  }, [metricKey, summary]);

  const insightItems = useMemo(
    () => buildInsightItems(metricKey, insights),
    [metricKey, insights]
  );

  const chartSubtitle = buildChartSubtitle({
    dataStart: data?.charts?.dataStart,
    dataEnd: data?.charts?.dataEnd,
    requestedSince: data?.charts?.requestedSince,
    requestedUntil: data?.charts?.requestedUntil,
  });

  const rankingSections = getFleetRankingKeys(kpiKey).map((key) => (
    <EnergyFleetMeterRanking
      key={key}
      title={RANKING_LABELS[key]}
      rows={rankings[key] || []}
      unit={config?.unit}
    />
  ));

  if (!config) return null;

  return (
    <EnergyMeterDrilldownModal
      show={show}
      title={config.title}
      subtitle={chartSubtitle || 'Fleet-wide analytics'}
      snapshot={<EnergyFleetSnapshot snapshot={data?.fleetSnapshot} />}
      onHide={onHide}
      loading={loading}
      toolbar={<EnergyChartRangePills ranges={CHART_RANGES} value={range} onChange={setRange} />}
      summary={<EnergyInsightStatGrid items={summaryItems} />}
      charts={
        <EnergyMultiLineChart
          chartSeries={chartSeries}
          visibleMeters={visibleMeters}
          range={range}
          unit={config.unit}
          height={280}
          referenceLines={data?.charts?.referenceLines || []}
          loading={false}
        />
      }
      insights={
        <>
          {insightItems.length > 0 && <EnergyInsightsPanel items={insightItems} />}
          {rankingSections}
        </>
      }
    />
  );
}
