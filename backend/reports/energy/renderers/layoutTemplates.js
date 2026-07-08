const TEMPLATE_ORDER = ['cover', 'summary', 'analytics', 'tables', 'closing'];

function defaultTemplateForGroup(group) {
  if (group === 'ExecutiveSummary') return 'summary';
  if (group === 'FleetAnalytics') return 'analytics';
  if (group === 'FleetTables' || group === 'AlarmSummary') return 'tables';
  if (group === 'Signatures') return 'closing';
  return 'summary';
}

function templateMatches(template, section) {
  if (section.templates?.length) return section.templates.includes(template);
  return defaultTemplateForGroup(section.group) === template;
}

module.exports = {
  TEMPLATE_ORDER,
  defaultTemplateForGroup,
  templateMatches,
};
