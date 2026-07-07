export const REPORT_TYPES = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
];

export const PERIOD_PRESETS = {
  weekly: [
    { key: 'last_week', label: 'Last Week' },
    { key: 'current_week', label: 'Current Week' },
  ],
  monthly: [
    { key: 'previous_month', label: 'Previous Month' },
    { key: 'current_month', label: 'Current Month' },
  ],
  yearly: [
    { key: 'previous_year', label: 'Previous Year' },
    { key: 'current_year', label: 'Current Year' },
  ],
};

export const OUTPUT_FORMATS = [
  { key: 'pdf', label: 'PDF', enabled: true },
  { key: 'xlsx', label: 'Excel', enabled: false, hint: 'Coming soon' },
  { key: 'csv', label: 'CSV', enabled: false, hint: 'Coming soon' },
];

export function getPeriodOptions(reportType) {
  return PERIOD_PRESETS[reportType] || [];
}

export function getDefaultPeriodPreset(reportType) {
  const options = getPeriodOptions(reportType);
  return options[0]?.key || 'last_week';
}
