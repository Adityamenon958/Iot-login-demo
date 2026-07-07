const path = require('path');
const fs = require('fs');

const CHART_FONT_FAMILY = 'DejaVu Sans';
const FONTS_DIR = path.join(__dirname, 'fonts');
const FONT_FILES = {
  regular: path.join(FONTS_DIR, 'DejaVuSans.ttf'),
  bold: path.join(FONTS_DIR, 'DejaVuSans-Bold.ttf'),
};

function ensureChartFontsPresent() {
  Object.entries(FONT_FILES).forEach(([variant, filePath]) => {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing chart font (${variant}): ${filePath}`);
    }
  });
}

function registerChartFonts(registerFont) {
  if (typeof registerFont !== 'function') return;

  ensureChartFontsPresent();
  registerFont(FONT_FILES.regular, { family: CHART_FONT_FAMILY });
  registerFont(FONT_FILES.bold, { family: CHART_FONT_FAMILY, weight: 'bold' });
}

function applyChartFontDefaults(ChartJS) {
  ChartJS.defaults.font.family = CHART_FONT_FAMILY;
  ChartJS.defaults.color = '#495057';
}

module.exports = {
  CHART_FONT_FAMILY,
  registerChartFonts,
  applyChartFontDefaults,
};
