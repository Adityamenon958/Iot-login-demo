const {
  getWeekStartIstUtc,
  getPreviousWeekStartIstUtc,
  getMonthStartIstUtc,
  getPreviousMonthStartIstUtc,
  getYearStartIstUtc,
  getPreviousYearStartIstUtc,
  getISTDateComponentsFromUtcDate,
  istStartUtcFromYMD,
} = require('../../utils/meterInsightsUtils');
const { PERIOD_PRESETS_BY_TYPE, REPORT_TYPES } = require('./reportTypes');

const PERIOD_LABELS = {
  last_week: 'Last Week',
  current_week: 'Current Week',
  previous_month: 'Previous Month',
  current_month: 'Current Month',
  previous_year: 'Previous Year',
  current_year: 'Current Year',
};

function resolveReportPeriod(reportType, periodPreset, now = new Date()) {
  if (!REPORT_TYPES.includes(reportType)) {
    throw Object.assign(new Error(`Invalid reportType: ${reportType}`), { statusCode: 400 });
  }
  const allowed = PERIOD_PRESETS_BY_TYPE[reportType] || [];
  if (!allowed.includes(periodPreset)) {
    throw Object.assign(new Error(`Invalid periodPreset "${periodPreset}" for reportType "${reportType}"`), {
      statusCode: 400,
    });
  }

  let from;
  let to;
  let compareFrom;
  let compareTo;

  if (periodPreset === 'last_week') {
    from = getPreviousWeekStartIstUtc(now);
    const thisWeekStart = getWeekStartIstUtc(now);
    to = new Date(thisWeekStart.getTime() - 1);
    compareFrom = new Date(from.getTime() - 7 * 24 * 60 * 60 * 1000);
    compareTo = new Date(from.getTime() - 1);
  } else if (periodPreset === 'current_week') {
    from = getWeekStartIstUtc(now);
    to = now;
    compareFrom = getPreviousWeekStartIstUtc(now);
    compareTo = new Date(from.getTime() - 1);
  } else if (periodPreset === 'previous_month') {
    from = getPreviousMonthStartIstUtc(now);
    to = new Date(getMonthStartIstUtc(now).getTime() - 1);
    compareFrom = getPreviousMonthStartIstUtc(from);
    compareTo = new Date(from.getTime() - 1);
  } else if (periodPreset === 'current_month') {
    from = getMonthStartIstUtc(now);
    to = now;
    compareFrom = getPreviousMonthStartIstUtc(now);
    compareTo = new Date(from.getTime() - 1);
  } else if (periodPreset === 'previous_year') {
    from = getPreviousYearStartIstUtc(now);
    to = new Date(getYearStartIstUtc(now).getTime() - 1);
    compareFrom = getPreviousYearStartIstUtc(from);
    compareTo = new Date(from.getTime() - 1);
  } else if (periodPreset === 'current_year') {
    from = getYearStartIstUtc(now);
    to = now;
    compareFrom = getPreviousYearStartIstUtc(now);
    compareTo = new Date(from.getTime() - 1);
  }

  const periodMs = Math.max(1, to.getTime() - from.getTime());
  const periodDays = Math.max(1, Math.ceil(periodMs / (24 * 60 * 60 * 1000)));

  return {
    reportType,
    periodPreset,
    periodLabel: PERIOD_LABELS[periodPreset] || periodPreset,
    from,
    to,
    compareFrom,
    compareTo,
    periodDays,
    timezone: 'Asia/Kolkata',
  };
}

function validateReportRequest(body) {
  const { reportType, periodPreset, format = 'pdf', scope = 'fleet' } = body || {};
  if (!reportType || !periodPreset) {
    throw Object.assign(new Error('reportType and periodPreset are required'), { statusCode: 400 });
  }
  if (format !== 'pdf') {
    throw Object.assign(new Error('Only pdf format is supported in v1'), { statusCode: 400 });
  }
  if (scope !== 'fleet') {
    throw Object.assign(new Error('Only fleet scope is supported in v1'), { statusCode: 400 });
  }
  return { reportType, periodPreset, format, scope };
}

module.exports = { resolveReportPeriod, validateReportRequest, PERIOD_LABELS };
