/**
 * @typedef {'cover'|'summary'|'analytics'|'tables'|'closing'} PageTemplateType
 * @typedef {'ExecutiveSummary'|'FleetAnalytics'|'FleetTables'|'AlarmSummary'|'Signatures'} SectionGroup
 * @typedef {'Large'|'Medium'|'Compact'} SectionVariant
 *
 * @typedef {Object} SectionMeasurement
 * @property {number} preferredHeight
 * @property {number} minimumHeight
 * @property {boolean} canSplit
 * @property {boolean} keepWithNext
 * @property {number} priority
 * @property {Record<SectionVariant, number>} [variants]
 * @property {Object} [meta]
 *
 * @typedef {Object} SectionDescriptor
 * @property {string} id
 * @property {SectionGroup} group
 * @property {PageTemplateType[]} templates
 * @property {(context: any) => SectionMeasurement} measure
 * @property {(context: any, constraints: { variant: SectionVariant, availableHeight: number, pageIndex: number }) => { height: number, variant: SectionVariant, splitInfo?: any }} layout
 * @property {(doc: import('pdfkit'), context: any, frame: any) => number} render
 */

const SECTION_VARIANTS = Object.freeze({
  LARGE: 'Large',
  MEDIUM: 'Medium',
  COMPACT: 'Compact',
});

function withDefaults(measurement = {}) {
  return {
    preferredHeight: Number(measurement.preferredHeight) || 0,
    minimumHeight: Number(measurement.minimumHeight) || Number(measurement.preferredHeight) || 0,
    canSplit: measurement.canSplit === true,
    keepWithNext: measurement.keepWithNext === true,
    priority: Number.isFinite(Number(measurement.priority)) ? Number(measurement.priority) : 50,
    variants: measurement.variants || {},
    meta: measurement.meta || {},
  };
}

module.exports = {
  SECTION_VARIANTS,
  withDefaults,
};
