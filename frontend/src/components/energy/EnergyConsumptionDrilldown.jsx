import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import EnergyMeterDrilldownModal from './EnergyMeterDrilldownModal';
import EnergyChartRangePills from './EnergyChartRangePills';
import EnergyInsightStatGrid from './EnergyInsightStatGrid';
import EnergyInsightsPanel from './EnergyInsightsPanel';
import EnergyDailyBarChart from './EnergyDailyBarChart';
import EnergyHourlyBarChart from './EnergyHourlyBarChart';
import { CONSUMPTION_PERIODS } from './meterParameterConfig';
import { buildConsumptionSummaryDateHints } from '../../utils/consumptionSummaryDateHints';

export default function EnergyConsumptionDrilldown({ show, meterId, onHide, refreshKey = 0 }) {
  const [period, setPeriod] = useState('7d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!meterId) return;
    setLoading(true);
    try {
      const res = await axios.get('/api/energy-meter/consumption-insights', {
        params: { meterId, period },
        withCredentials: true,
      });
      setData(res.data);
    } catch (err) {
      console.error('Consumption insights fetch failed:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [meterId, period]);

  useEffect(() => {
    if (show && meterId) fetchInsights();
  }, [show, meterId, fetchInsights, refreshKey]);

  const summary = data?.summary || {};
  const comparisons = data?.comparisons || {};
  const insights = data?.insights || {};

  const summaryItems = useMemo(() => {
    const dateHints = buildConsumptionSummaryDateHints(period);
    const items = [
      {
        key: 'today',
        label: "Today's Consumption",
        dateHint: dateHints.today,
        value: summary.todayKwh,
        unit: 'kWh',
        comparison: comparisons.todayVsYesterday,
        comparisonKey: 'todayVsYesterday',
      },
      {
        key: 'yesterday',
        label: 'Yesterday',
        dateHint: dateHints.yesterday,
        value: summary.yesterdayKwh,
        unit: 'kWh',
      },
      {
        key: 'week',
        label: 'This Week',
        dateHint: dateHints.week,
        value: summary.weekKwh,
        unit: 'kWh',
        comparison: comparisons.weekVsPreviousWeek,
        comparisonKey: 'weekVsPreviousWeek',
      },
      {
        key: 'month',
        label: 'This Month',
        dateHint: dateHints.month,
        value: summary.monthKwh,
        unit: 'kWh',
        comparison: comparisons.monthVsPreviousMonth,
        comparisonKey: 'monthVsPreviousMonth',
      },
      {
        key: 'periodTotal',
        label: period === '30d' ? '30-Day Total' : '7-Day Total',
        dateHint: dateHints.periodTotal,
        value: summary.periodTotalKwh,
        unit: 'kWh',
      },
      {
        key: 'avgDaily',
        label: 'Avg Daily',
        dateHint: dateHints.avgDaily,
        value: summary.avgDailyKwh,
        unit: 'kWh',
      },
      {
        key: 'projected',
        label: 'Projected Month End',
        dateHint: dateHints.projected,
        value: summary.projectedMonthEndKwh,
        unit: 'kWh',
      },
      {
        key: 'register',
        label: 'Cumulative Register',
        dateHint: dateHints.register,
        value: summary.cumulativeRegisterKwh,
        unit: 'kWh',
        sublabel: 'Lifetime meter reading',
      },
    ];
    return items;
  }, [summary, comparisons, period]);

  const insightItems = useMemo(() => {
    const items = [];
    if (insights.peakUsageHourToday) {
      items.push({
        key: 'peakHour',
        label: 'Peak Usage Hour Today',
        type: 'hourRange',
        value: insights.peakUsageHourToday,
      });
    }
    if (insights.highestDay) {
      items.push({
        key: 'highest',
        label: 'Highest Day',
        type: 'dayConsumption',
        value: insights.highestDay,
      });
    }
    if (insights.lowestDay) {
      items.push({
        key: 'lowest',
        label: 'Lowest Day',
        type: 'dayConsumption',
        value: insights.lowestDay,
      });
    }
    if (insights.minimalUsageDays != null) {
      items.push({
        key: 'minimal',
        label: 'Days with Minimal Usage',
        value: insights.minimalUsageDays,
      });
    }
    return items;
  }, [insights]);

  return (
    <EnergyMeterDrilldownModal
      show={show}
      title="Energy Consumption"
      subtitle="Period consumption from meter register deltas (IST)"
      onHide={onHide}
      loading={loading}
      toolbar={
        <EnergyChartRangePills ranges={CONSUMPTION_PERIODS} value={period} onChange={setPeriod} />
      }
      summary={<EnergyInsightStatGrid items={summaryItems} />}
      charts={
        <>
          <EnergyDailyBarChart data={data?.charts?.dailyBreakdown || []} />
          <EnergyHourlyBarChart
            data={data?.charts?.hourlyBreakdownToday || []}
            peakHourStart={insights.peakUsageHourToday?.start}
          />
        </>
      }
      insights={<EnergyInsightsPanel items={insightItems} />}
    />
  );
}
