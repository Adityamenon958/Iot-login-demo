const REPORT_TYPES = ['weekly', 'monthly', 'yearly'];

const PERIOD_PRESETS_BY_TYPE = {
  weekly: ['last_week', 'current_week'],
  monthly: ['previous_month', 'current_month'],
  yearly: ['previous_year', 'current_year'],
};

const OUTPUT_FORMATS = ['pdf'];

const REPORT_SCOPES = ['fleet', 'meter'];

const LARGE_FLEET_ASYNC_THRESHOLD = 50;

const ALARM_EVENTS_PDF_LIMIT = 500;

module.exports = {
  REPORT_TYPES,
  PERIOD_PRESETS_BY_TYPE,
  OUTPUT_FORMATS,
  REPORT_SCOPES,
  LARGE_FLEET_ASYNC_THRESHOLD,
  ALARM_EVENTS_PDF_LIMIT,
};
