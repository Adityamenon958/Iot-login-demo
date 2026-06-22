import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import EnergyMeterDrilldownModal from './EnergyMeterDrilldownModal';
import EnergyChartRangePills from './EnergyChartRangePills';
import EnergyInsightStatGrid from './EnergyInsightStatGrid';
import EnergyInsightsPanel from './EnergyInsightsPanel';
import EnergyMultiLineChart from './EnergyMultiLineChart';
import { CHART_RANGES, buildChartSubtitle } from './energyChartShared';
import { getParameterDrilldown } from './meterParameterConfig';

function buildSummaryItems(metricKey, summary, unit, decimals) {
  if (metricKey === 'activePower') {
    return [
      { key: 'current', label: 'Current Load', value: summary.currentPower, unit, decimals },
      { key: 'peak', label: 'Peak Demand', value: summary.peakPower, unit, decimals },
      { key: 'avg', label: 'Average Load', value: summary.averagePower, unit, decimals },
      {
        key: 'lf',
        label: 'Load Factor',
        value: summary.loadFactor != null ? Math.round(summary.loadFactor * 100) : null,
        unit: '%',
        decimals: 0,
      },
      { key: 'energy', label: 'Energy in Range', value: summary.energyInRange, unit: 'kWh', decimals: 2 },
    ];
  }

  const items = [
    { key: 'current', label: 'Current', value: summary.current, unit, decimals },
    { key: 'min', label: 'Min', value: summary.min, unit, decimals },
    { key: 'max', label: 'Max', value: summary.max, unit, decimals },
    { key: 'avg', label: 'Average', value: summary.average, unit, decimals },
  ];

  if (summary.variation != null && metricKey !== 'frequency') {
    items.push({ key: 'var', label: 'Variation', value: summary.variation, unit, decimals });
  }

  if (summary.timeInRangePercent != null && metricKey !== 'current') {
    items.push({
      key: 'tir',
      label: metricKey === 'frequency' ? 'Time in Healthy Band' : 'Time in Range',
      value: summary.timeInRangePercent,
      unit: '%',
      decimals: 1,
    });
  }

  if (summary.status && summary.status !== 'unknown') {
    items.push({
      key: 'status',
      label: 'Status',
      value: summary.status.charAt(0).toUpperCase() + summary.status.slice(1),
      unit: '',
    });
  }

  return items;
}

function buildInsightItems(metricKey, insights) {
  if (metricKey === 'activePower') {
    return [
      { key: 'runToday', label: 'Running Hours Today', value: insights.runningHoursToday, unit: 'hrs' },
      { key: 'runPeriod', label: 'Running Hours in Period', value: insights.runningHoursInPeriod, unit: 'hrs' },
      { key: 'peakAt', label: 'Peak Demand Time', type: 'timestamp', value: insights.peakDemandAt },
      { key: 'peakKw', label: 'Peak Demand', value: insights.peakDemandKw, unit: 'kW' },
      { key: 'lowAt', label: 'Lowest Demand Time', type: 'timestamp', value: insights.lowestDemandAt },
      { key: 'lowKw', label: 'Lowest Demand', value: insights.lowestDemandKw, unit: 'kW' },
      {
        key: 'threshold',
        label: 'Running Threshold',
        value: insights.runningThresholdKw,
        unit: 'kW',
      },
    ];
  }

  if (metricKey === 'voltage') {
    return [
      { key: 'under', label: 'Undervoltage Events', value: insights.undervoltageEventCount },
      { key: 'over', label: 'Overvoltage Events', value: insights.overvoltageEventCount },
      { key: 'tir', label: 'Time in Range', value: insights.timeInRangePercent, unit: '%' },
    ];
  }

  if (metricKey === 'current') {
    return [
      { key: 'peakAt', label: 'Peak Current Time', type: 'timestamp', value: insights.peakCurrentAt },
      { key: 'peak', label: 'Peak Current', value: insights.peakCurrent, unit: 'A' },
      { key: 'lowAt', label: 'Lowest Current Time', type: 'timestamp', value: insights.lowestCurrentAt },
      { key: 'low', label: 'Lowest Current', value: insights.lowestCurrent, unit: 'A' },
    ];
  }

  if (metricKey === 'powerFactor') {
    return [
      { key: 'compliance', label: 'PF Compliance', value: insights.pfCompliancePercent, unit: '%' },
      { key: 'risk', label: 'Penalty Risk', type: 'penaltyRisk', value: insights.penaltyRisk },
      { key: 'worstAt', label: 'Worst PF Time', type: 'timestamp', value: insights.worstPfAt },
      { key: 'worst', label: 'Worst PF', value: insights.worstPf },
      { key: 'below90', label: 'Time Below 0.90', value: insights.timeBelowNinetyPercent, unit: '%' },
    ];
  }

  if (metricKey === 'frequency') {
    return [
      {
        key: 'healthy',
        label: 'Time in Healthy Band',
        value: insights.timeInHealthyBandPercent,
        unit: '%',
      },
    ];
  }

  return [];
}

export default function EnergyMetricDrilldown({
  show,
  meterId,
  parameterKey,
  onHide,
  refreshKey = 0,
}) {
  const config = getParameterDrilldown(parameterKey);
  const metricKey = config?.metricKey || parameterKey;
  const [range, setRange] = useState('24h');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!meterId || !metricKey) return;
    setLoading(true);
    try {
      const res = await axios.get('/api/energy-meter/meter-metric-insights', {
        params: { meterId, metric: metricKey, range },
        withCredentials: true,
      });
      setData(res.data);
    } catch (err) {
      console.error('Metric insights fetch failed:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [meterId, metricKey, range]);

  useEffect(() => {
    if (show && meterId) fetchInsights();
  }, [show, meterId, fetchInsights, refreshKey]);

  const summary = data?.summary || {};
  const insights = data?.insights || {};
  const chartSeries = data?.charts?.chartSeries || [];
  const referenceLines = data?.charts?.referenceLines || [];
  const visibleMeters = useMemo(() => new Set(chartSeries.map((s) => s.meterId)), [chartSeries]);

  const summaryItems = useMemo(
    () => buildSummaryItems(metricKey, summary, config?.unit || '', config?.decimals ?? 2),
    [metricKey, summary, config]
  );

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

  if (!config) return null;

  return (
    <EnergyMeterDrilldownModal
      show={show}
      title={config.title}
      subtitle={chartSubtitle || 'Live reading on card · analytics below'}
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
          referenceLines={referenceLines}
          loading={false}
        />
      }
      insights={<EnergyInsightsPanel items={insightItems} />}
    />
  );
}
