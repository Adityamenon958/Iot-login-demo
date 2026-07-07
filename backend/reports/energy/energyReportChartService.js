const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { CHART_FONT_FAMILY, registerChartFonts, applyChartFontDefaults } = require('./chartFont');

const WIDTH = 700;
const HEIGHT = 280;
const COLORS = ['#4db3b3', '#6f42c1', '#d63384', '#fd7e14', '#198754', '#0d6efd', '#ffc107', '#dc3545', '#6c757d', '#20c997'];

const barValueLabelPlugin = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx, data, chartArea } = chart;
    const dataset = data.datasets[0];
    if (!dataset) return;
    const meta = chart.getDatasetMeta(0);
    meta.data.forEach((bar, index) => {
      const value = dataset.data[index];
      if (value == null || !Number.isFinite(Number(value))) return;
      const label = Number(value).toFixed(1);
      const barTop = Math.min(bar.y, bar.base);
      const barHeight = Math.abs(bar.base - bar.y);
      const barWidth = bar.width || 20;

      ctx.save();
      ctx.font = `bold 9px "${CHART_FONT_FAMILY}"`;
      const textWidth = ctx.measureText(label).width;

      if (barHeight > textWidth + 10) {
        // Vertical label centered inside the bar
        ctx.beginPath();
        ctx.rect(bar.x - barWidth / 2 + 2, barTop + 2, barWidth - 4, barHeight - 4);
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        ctx.translate(bar.x, barTop + barHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, 0);
      } else if (barHeight > 14) {
        // Short bar: horizontal label centered inside
        ctx.beginPath();
        ctx.rect(bar.x - barWidth / 2 + 2, barTop + 2, barWidth - 4, barHeight - 4);
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, bar.x, barTop + barHeight / 2);
      } else {
        // Very short bar: label above, within chart area
        ctx.fillStyle = '#212529';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const y = Math.max(chartArea.top + 2, barTop - 4);
        ctx.fillText(label, bar.x, y);
      }
      ctx.restore();
    });
  },
};

function createCanvas(height = HEIGHT) {
  const canvas = new ChartJSNodeCanvas({
    width: WIDTH,
    height,
    backgroundColour: 'white',
    chartCallback: applyChartFontDefaults,
    plugins: {
      modern: [barValueLabelPlugin],
    },
  });
  registerChartFonts(canvas.registerFont.bind(canvas));
  return canvas;
}

let canvasInstance = null;

function getCanvas() {
  if (!canvasInstance) canvasInstance = createCanvas();
  return canvasInstance;
}

function formatDateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
}

function chartHeightForBarCount(count) {
  if (count <= 7) return 260;
  if (count <= 14) return 280;
  return 300;
}

async function renderDailyEnergyBarChart(title, labels, values) {
  const height = chartHeightForBarCount(labels.length);
  const canvas = createCanvas(height);

  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: title,
        data: values,
        backgroundColor: '#6f42c1',
        borderRadius: 3,
        maxBarThickness: 48,
      }],
    },
    options: {
      responsive: false,
      layout: { padding: { top: 22 } },
      plugins: {
        title: { display: true, text: title, font: { size: 14, weight: 'bold' } },
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'kWh' },
          grace: '8%',
        },
        x: {
          ticks: { maxRotation: 45, minRotation: 0, font: { size: 9 }, autoSkip: labels.length > 20 },
        },
      },
    },
  };
  const buffer = await canvas.renderToBuffer(config);
  return { buffer, aspectHint: height / WIDTH };
}

async function renderBarChart(title, labels, values, yLabel = '') {
  const canvas = getCanvas();
  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: title,
        data: values,
        backgroundColor: '#6f42c1',
        borderRadius: 3,
      }],
    },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: title, font: { size: 14, weight: 'bold' } },
        legend: { display: false },
      },
      scales: {
        y: { beginAtZero: true, title: { display: !!yLabel, text: yLabel } },
        x: { ticks: { maxRotation: 45, font: { size: 9 } } },
      },
    },
  };
  return { buffer: await canvas.renderToBuffer(config), aspectHint: HEIGHT / WIDTH };
}

async function renderLineChart(title, labels, values, yLabel = '', color = '#4db3b3') {
  const canvas = getCanvas();
  const config = {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: title,
        data: values,
        borderColor: color,
        backgroundColor: `${color}33`,
        fill: true,
        tension: 0.3,
        pointRadius: labels.length > 20 ? 0 : 2,
      }],
    },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: title, font: { size: 14, weight: 'bold' } },
        legend: { display: false },
      },
      scales: {
        y: { beginAtZero: false, title: { display: !!yLabel, text: yLabel } },
        x: { ticks: { maxRotation: 45, font: { size: 9 }, autoSkip: labels.length > 20 } },
      },
    },
  };
  return { buffer: await canvas.renderToBuffer(config), aspectHint: HEIGHT / WIDTH };
}

async function renderDoughnutChart(title, labels, values) {
  const canvas = getCanvas();
  const config = {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: COLORS.slice(0, labels.length),
      }],
    },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: title, font: { size: 14, weight: 'bold' } },
        legend: { position: 'right', labels: { font: { size: 10 }, boxWidth: 12 } },
      },
    },
  };
  return { buffer: await canvas.renderToBuffer(config), aspectHint: 0.55 };
}

async function renderAlarmDistributionChart(distribution) {
  const labels = ['Critical (Active)', 'Warning (Active)', 'Acknowledged', 'Cleared'];
  const values = [
    distribution.critical || 0,
    distribution.warning || 0,
    distribution.acknowledged || 0,
    distribution.cleared || 0,
  ];
  const canvas = getCanvas();
  const config = {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Alarms',
        data: values,
        backgroundColor: ['#dc3545', '#ffc107', '#0d6efd', '#198754'],
      }],
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: 'Alarm Distribution',
          font: { size: 14, weight: 'bold' },
        },
        legend: { display: false },
      },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  };
  return { buffer: await canvas.renderToBuffer(config), aspectHint: HEIGHT / WIDTH };
}

function topMetersForDoughnut(energyByMeter, limit = 10) {
  const top = energyByMeter.slice(0, limit);
  const restKwh = energyByMeter.slice(limit).reduce((s, m) => s + m.kwh, 0);
  const labels = top.map((m) => m.meterId);
  const values = top.map((m) => m.kwh);
  if (restKwh > 0) {
    labels.push('Others');
    values.push(restKwh);
  }
  return { labels, values };
}

async function buildReportCharts({ dailyBreakdown, trendSeries, energyByMeter, alarms }) {
  const charts = [];

  if (dailyBreakdown?.length) {
    const labels = dailyBreakdown.map((d) => formatDateLabel(d.date));
    const values = dailyBreakdown.map((d) => d.kwh);
    const { buffer, aspectHint } = await renderDailyEnergyBarChart('Daily Energy Consumption', labels, values);
    charts.push({
      key: 'daily_energy',
      title: 'Daily Energy Consumption',
      caption: 'Total fleet kWh per day (IST)',
      imageBuffer: buffer,
      aspectHint,
      preferredHeight: chartHeightForBarCount(labels.length) * (495 / WIDTH),
    });
  }

  if (trendSeries?.energy?.length) {
    const labels = trendSeries.energy.map((d) => formatDateLabel(d.date));
    const values = trendSeries.energy.map((d) => d.value);
    const { buffer, aspectHint } = await renderLineChart('Energy Consumption Trend', labels, values, 'kWh', '#6f42c1');
    charts.push({
      key: 'energy_trend',
      title: 'Energy Consumption Trend',
      caption: 'Fleet total energy over the reporting period',
      imageBuffer: buffer,
      aspectHint,
    });
  }

  if (trendSeries?.activePower?.length) {
    const labels = trendSeries.activePower.map((d) => formatDateLabel(d.date));
    const values = trendSeries.activePower.map((d) => d.value);
    const { buffer, aspectHint } = await renderLineChart('Peak Active Power Trend', labels, values, 'kW', '#d63384');
    charts.push({
      key: 'peak_power_trend',
      title: 'Peak Active Power Trend',
      caption: 'Daily peak active power (kW)',
      imageBuffer: buffer,
      aspectHint,
    });
  }

  if (trendSeries?.powerFactor?.length) {
    const labels = trendSeries.powerFactor.map((d) => formatDateLabel(d.date));
    const values = trendSeries.powerFactor.map((d) => d.value);
    const { buffer, aspectHint } = await renderLineChart('Average Power Factor Trend', labels, values, 'PF', '#198754');
    charts.push({
      key: 'pf_trend',
      title: 'Average Power Factor Trend',
      caption: 'Daily average fleet power factor',
      imageBuffer: buffer,
      aspectHint,
    });
  }

  if (energyByMeter?.length) {
    const { labels, values } = topMetersForDoughnut(energyByMeter);
    const { buffer, aspectHint } = await renderDoughnutChart('Energy Contribution by Meter', labels, values);
    charts.push({
      key: 'energy_by_meter',
      title: 'Energy Contribution by Meter',
      caption: 'Share of total fleet consumption',
      imageBuffer: buffer,
      aspectHint,
      preferredHeight: 200,
    });
  }

  if (alarms?.distribution) {
    const total = Object.values(alarms.distribution).reduce((s, v) => s + v, 0);
    if (total > 0) {
      const { buffer, aspectHint } = await renderAlarmDistributionChart(alarms.distribution);
      charts.push({
        key: 'alarm_distribution',
        title: 'Alarm Distribution',
        caption: 'Breakdown by severity and status',
        imageBuffer: buffer,
        aspectHint,
      });
    }
  }

  return charts;
}

module.exports = { buildReportCharts };
