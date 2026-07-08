const { SECTION_VARIANTS, withDefaults } = require('./sectionContract');
const { templateMatches } = require('./layoutTemplates');
const { addTrace } = require('./layoutDebug');

function remainingHeight(page, pageBottom) {
  return pageBottom - page.cursorY;
}

function chooseVariant(measurement, availableHeight) {
  const variants = measurement.variants || {};
  const options = [SECTION_VARIANTS.LARGE, SECTION_VARIANTS.MEDIUM, SECTION_VARIANTS.COMPACT];
  for (const v of options) {
    const h = variants[v];
    if (h != null && h <= availableHeight) return { variant: v, height: h };
  }
  if (measurement.preferredHeight <= availableHeight) {
    return { variant: SECTION_VARIANTS.LARGE, height: measurement.preferredHeight };
  }
  return null;
}

function newPage(index, topY, template = 'summary') {
  return { index, template, cursorY: topY, frames: [], exhausted: false };
}

function resolvePlacementChoice(measurement, available) {
  const choice = chooseVariant(measurement, available);
  if (choice) return choice;
  if (available <= 0) return null;
  return {
    variant: SECTION_VARIANTS.COMPACT,
    height: available,
  };
}

function buildLayoutPlan({ sections, context, pageTop, pageBottom, firstTemplate = 'summary', debugState }) {
  const pages = [newPage(0, pageTop, firstTemplate)];
  const measurements = {};

  sections.forEach((section) => {
    measurements[section.id] = withDefaults(section.measure(context));
  });

  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    const measurement = measurements[section.id];
    const nextSection = sections[i + 1];
    const nextMeasurement = nextSection ? measurements[nextSection.id] : null;
    let page = pages[pages.length - 1];
    if (page.exhausted) {
      page = newPage(pages.length, pageTop, section.templates?.[0] || page.template);
      pages.push(page);
      addTrace(debugState, {
        type: 'pageBreak',
        sectionId: section.id,
        reason: 'pageExhausted',
      });
    }
    if (!templateMatches(page.template, section)) {
      const availableBefore = remainingHeight(page, pageBottom);
      const fitsOnCurrent = availableBefore >= measurement.minimumHeight
        && chooseVariant(measurement, availableBefore);

      if (fitsOnCurrent) {
        const previousTemplate = page.template;
        page.template = section.templates?.[0] || page.template;
        addTrace(debugState, {
          type: 'softTemplateTransition',
          sectionId: section.id,
          from: previousTemplate,
          to: page.template,
          available: availableBefore,
        });
      } else {
        page = newPage(pages.length, pageTop, section.templates?.[0] || page.template);
        pages.push(page);
        addTrace(debugState, {
          type: 'pageBreak',
          sectionId: section.id,
          reason: 'templateChange',
        });
      }
    }

    let available = remainingHeight(page, pageBottom);
    if (measurement.keepWithNext && nextMeasurement) {
      const nextHeights = Object.values(nextMeasurement.variants || {})
        .filter((h) => Number.isFinite(h) && h > 0);
      const nextSmallest = nextHeights.length
        ? Math.min(...nextHeights)
        : nextMeasurement.minimumHeight;
      const needed = measurement.minimumHeight + nextSmallest + (context.sectionGap || 0);
      if (available < needed) {
        page = newPage(pages.length, pageTop, page.template);
        pages.push(page);
        addTrace(debugState, {
          type: 'pageBreak',
          sectionId: section.id,
          reason: 'keepWithNext',
        });
        available = remainingHeight(page, pageBottom);
      }
    }
    let choice = resolvePlacementChoice(measurement, available);

    if (!choice || available < measurement.minimumHeight) {
      page = newPage(pages.length, pageTop, page.template);
      pages.push(page);
      available = remainingHeight(page, pageBottom);
      choice = resolvePlacementChoice(measurement, available);
      if (!choice) {
        addTrace(debugState, {
          type: 'pageBreak',
          sectionId: section.id,
          reason: 'noSpace',
        });
        continue;
      }
      addTrace(debugState, {
        type: 'pageBreak',
        sectionId: section.id,
        reason: !choice ? 'noVariantFits' : 'minimumHeight',
      });
    }

    const frame = {
      sectionId: section.id,
      pageIndex: page.index,
      x: context.margin,
      y: page.cursorY,
      width: context.contentWidth,
      height: choice.height,
      variant: choice.variant,
      debug: debugState,
    };
    page.frames.push(frame);
    page.cursorY += choice.height + (context.sectionGap || 0);
    if (measurement.preferredHeight > choice.height + 2) {
      page.exhausted = true;
    }
    if (remainingHeight(page, pageBottom) < 72) {
      page.exhausted = true;
    }
    addTrace(debugState, {
      type: 'place',
      sectionId: section.id,
      pageIndex: page.index,
      variant: choice.variant,
      measured: measurement,
      height: choice.height,
      remaining: remainingHeight(page, pageBottom),
    });
  }

  const nonEmptyPages = pages.filter((p) => p.frames.length > 0);
  nonEmptyPages.forEach((p, idx) => {
    p.index = idx;
    p.frames.forEach((f) => {
      f.pageIndex = idx;
    });
  });
  return { pages: nonEmptyPages, measurements };
}

module.exports = {
  buildLayoutPlan,
};
