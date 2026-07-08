const EnergyMeterAlarmEvent = require('../../models/EnergyMeterAlarmEvent');
const { ALARM_EVENTS_PDF_LIMIT } = require('./reportTypes');

function resolveAlarmBucketMode(period) {
  return period.reportType === 'yearly' ? 'month' : 'day';
}

function formatAlarmBucket(date, bucketMode) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const key = `${get('year')}-${get('month')}-${get('day')}`;
  return bucketMode === 'month' ? key.slice(0, 7) : key;
}

async function aggregateAlarmData(meters, period, meterRows) {
  const meterIds = meters.map((m) => m.deviceId);
  const { from, to } = period;
  const bucketMode = resolveAlarmBucketMode(period);

  const events = await EnergyMeterAlarmEvent.find({
    meterId: { $in: meterIds },
    triggeredAt: { $gte: from, $lte: to },
  })
    .sort({ triggeredAt: -1 })
    .lean();

  const summary = {
    total: events.length,
    critical: 0,
    warning: 0,
    active: 0,
    acknowledged: 0,
    cleared: 0,
  };

  const distribution = { critical: 0, warning: 0, acknowledged: 0, cleared: 0 };
  const byMeter = {};
  const byMeterBucket = {};

  events.forEach((e) => {
    if (e.severity === 'critical') summary.critical += 1;
    if (e.severity === 'warning') summary.warning += 1;
    if (e.status === 'active') {
      summary.active += 1;
      if (e.severity === 'critical') distribution.critical += 1;
      else distribution.warning += 1;
    }
    if (e.status === 'acknowledged') {
      summary.acknowledged += 1;
      distribution.acknowledged += 1;
    }
    if (e.status === 'cleared') {
      summary.cleared += 1;
      distribution.cleared += 1;
    }

    if (!byMeter[e.meterId]) {
      byMeter[e.meterId] = { total: 0, critical: 0, warning: 0 };
    }
    byMeter[e.meterId].total += 1;
    if (e.severity === 'critical') byMeter[e.meterId].critical += 1;
    if (e.severity === 'warning') byMeter[e.meterId].warning += 1;

    const bucket = formatAlarmBucket(new Date(e.triggeredAt), bucketMode);
    if (!byMeterBucket[e.meterId]) byMeterBucket[e.meterId] = {};
    if (!byMeterBucket[e.meterId][bucket]) {
      byMeterBucket[e.meterId][bucket] = { total: 0, critical: 0, warning: 0 };
    }
    byMeterBucket[e.meterId][bucket].total += 1;
    if (e.severity === 'critical') byMeterBucket[e.meterId][bucket].critical += 1;
    if (e.severity === 'warning') byMeterBucket[e.meterId][bucket].warning += 1;
  });

  meterRows.forEach((row) => {
    const counts = byMeter[row.meterId] || { total: 0, critical: 0, warning: 0 };
    row.alarmCount = counts.total;
    row.criticalAlarms = counts.critical;
    row.warningAlarms = counts.warning;
  });

  const eventRows = events.slice(0, ALARM_EVENTS_PDF_LIMIT).map((e) => ({
    triggeredAt: e.triggeredAt,
    meterId: e.meterId,
    meterName: e.meterName || e.meterId,
    metric: e.metric,
    threshold: e.threshold,
    actualValue: e.actualValue,
    severity: e.severity,
    status: e.status,
    conditionLabel: e.conditionLabel || '',
  }));

  return {
    summary: {
      ...summary,
      alarmCounts: summary,
    },
    distribution,
    byMeterBucket,
    events: eventRows,
    totalEvents: events.length,
    truncated: events.length > ALARM_EVENTS_PDF_LIMIT,
  };
}

module.exports = { aggregateAlarmData };
