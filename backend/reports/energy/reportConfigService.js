const { DEFAULT_REPORT_CONFIG } = require('./reportConfigDefaults');

function getReportConfig(companyName) {
  // v1: company overrides can be added via CompanyDashboardAccess later
  return JSON.parse(JSON.stringify(DEFAULT_REPORT_CONFIG));
}

module.exports = { getReportConfig };
