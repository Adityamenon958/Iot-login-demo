const { renderPdfReport } = require('./renderers/pdfReportRenderer');

const RENDERERS = {
  pdf: renderPdfReport,
};

async function renderReport(payload, format = 'pdf') {
  const renderer = RENDERERS[format];
  if (!renderer) {
    throw Object.assign(new Error(`Unsupported format: ${format}`), { statusCode: 400 });
  }
  return renderer(payload);
}

module.exports = { renderReport };
