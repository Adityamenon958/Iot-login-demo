const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const RUNNING_POWER_THRESHOLD_KW = 0.1;
const RUNNING_GAP_CAP_MS = 5 * 60 * 1000;

const VOLTAGE_BAND = { lower: 220, upper: 240 };
const PF_DRILLDOWN_BANDS = { healthy: 0.95, warning: 0.9 };
const FREQUENCY_BAND = { lower: 49.5, upper: 50.5 };

const CONSUMPTION_PERIOD_DAYS = {
  '7d': 7,
  '30d': 30,
};

function roundTo(value, decimals = 2) {
  if (value == null || !Number.isFinite(value)) return null;
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function getISTDateComponentsFromUtcDate(utcDate) {
  const istDate = new Date(utcDate.getTime() + IST_OFFSET_MS);
  return {
    year: istDate.getUTCFullYear(),
    month: istDate.getUTCMonth(),
    day: istDate.getUTCDate(),
    weekday: istDate.getUTCDay(),
  };
}

function istStartUtcFromYMD(y, m, d) {
  return new Date(Date.UTC(y, m, d, -5, -30, 0));
}

function getTodayStartIstUtc(now = new Date()) {
  const { year, month, day } = getISTDateComponentsFromUtcDate(now);
  return istStartUtcFromYMD(year, month, day);
}

function getYesterdayStartIstUtc(now = new Date()) {
  const today = getTodayStartIstUtc(now);
  return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

function getWeekStartIstUtc(now = new Date()) {
  const { year, month, day, weekday } = getISTDateComponentsFromUtcDate(now);
  const mondayOffset = weekday === 0 ? 6 : weekday - 1;
  const mondayDay = day - mondayOffset;
  return istStartUtcFromYMD(year, month, mondayDay);
}

function getPreviousWeekStartIstUtc(now = new Date()) {
  const thisWeek = getWeekStartIstUtc(now);
  return new Date(thisWeek.getTime() - 7 * 24 * 60 * 60 * 1000);
}

function getMonthStartIstUtc(now = new Date()) {
  const { year, month } = getISTDateComponentsFromUtcDate(now);
  return istStartUtcFromYMD(year, month, 1);
}

function getPreviousMonthStartIstUtc(now = new Date()) {
  const { year, month } = getISTDateComponentsFromUtcDate(now);
  if (month === 0) return istStartUtcFromYMD(year - 1, 11, 1);
  return istStartUtcFromYMD(year, month - 1, 1);
}

function getDaysInMonthIst(now = new Date()) {
  const { year, month } = getISTDateComponentsFromUtcDate(now);
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function getDaysElapsedInMonthIst(now = new Date()) {
  const { day } = getISTDateComponentsFromUtcDate(now);
  return day;
}

function formatIstDateKey(utcDate) {
  const { year, month, day } = getISTDateComponentsFromUtcDate(utcDate);
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function buildComparison(current, previous) {
  const cur = current != null && Number.isFinite(Number(current)) ? Number(current) : null;
  const prev = previous != null && Number.isFinite(Number(previous)) ? Number(previous) : null;

  if (cur == null && prev == null) {
    return { current: null, previous: null, deltaPct: null, direction: null };
  }

  let deltaPct = null;
  let direction = null;

  if (cur != null && prev != null) {
    if (prev === 0) {
      deltaPct = cur === 0 ? 0 : null;
      direction = cur > 0 ? 'up' : cur < 0 ? 'down' : 'flat';
    } else {
      deltaPct = roundTo(((cur - prev) / prev) * 100, 1);
      if (Math.abs(deltaPct) < 0.05) direction = 'flat';
      else direction = cur > prev ? 'up' : 'down';
    }
  }

  return {
    current: cur != null ? roundTo(cur, 2) : null,
    previous: prev != null ? roundTo(prev, 2) : null,
    deltaPct,
    direction,
  };
}

function countRangeExcursionEvents(points, { lower, upper, mode }) {
  if (!points?.length) return 0;

  let events = 0;
  let inExcursion = false;

  points.forEach((pt) => {
    const v = pt.value;
    if (v == null || !Number.isFinite(v)) return;

    let outside = false;
    if (mode === 'under' && v < lower) outside = true;
    if (mode === 'over' && v > upper) outside = true;

    if (outside && !inExcursion) {
      events += 1;
      inExcursion = true;
    } else if (!outside && inExcursion) {
      inExcursion = false;
    }
  });

  return events;
}

function computeTimeInRangePercent(points, lower, upper) {
  const valid = points.filter((p) => p.value != null && Number.isFinite(p.value));
  if (!valid.length) return null;
  const inRange = valid.filter((p) => p.value >= lower && p.value <= upper).length;
  return roundTo((inRange / valid.length) * 100, 1);
}

function computeTimeBelowPercent(points, threshold) {
  const valid = points.filter((p) => p.value != null && Number.isFinite(p.value));
  if (!valid.length) return null;
  const below = valid.filter((p) => p.value < threshold).length;
  return roundTo((below / valid.length) * 100, 1);
}

function computeRunningHours(logs, getPower, thresholdKw = RUNNING_POWER_THRESHOLD_KW, gapCapMs = RUNNING_GAP_CAP_MS) {
  if (!logs?.length || logs.length < 2) return 0;

  const sorted = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  let totalMs = 0;

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const p1 = getPower(sorted[i]);
    const p2 = getPower(sorted[i + 1]);
    const t1 = new Date(sorted[i].timestamp).getTime();
    const t2 = new Date(sorted[i + 1].timestamp).getTime();
    const gap = Math.min(Math.max(t2 - t1, 0), gapCapMs);

    const avgPower = [p1, p2].filter((p) => p != null && Number.isFinite(p));
    if (!avgPower.length) continue;
    const power = avgPower.reduce((s, v) => s + v, 0) / avgPower.length;
    if (power > thresholdKw) totalMs += gap;
  }

  return roundTo(totalMs / (1000 * 60 * 60), 1);
}

function findExtremumPoint(points, mode = 'max') {
  const valid = points.filter((p) => p.value != null && Number.isFinite(p.value));
  if (!valid.length) return null;

  let best = valid[0];
  valid.forEach((pt) => {
    if (mode === 'max' && pt.value > best.value) best = pt;
    if (mode === 'min' && pt.value < best.value) best = pt;
  });

  return { timestamp: best.timestamp, value: roundTo(best.value, 3) };
}

function computePfCompliance(points, healthyThreshold = PF_DRILLDOWN_BANDS.healthy) {
  const valid = points.filter((p) => p.value != null && Number.isFinite(p.value));
  if (!valid.length) return null;
  const compliant = valid.filter((p) => p.value >= healthyThreshold).length;
  return roundTo((compliant / valid.length) * 100, 1);
}

function computePenaltyRisk(compliancePct, minPf) {
  if (compliancePct == null && minPf == null) return 'unknown';
  const compliance = compliancePct ?? 0;
  const min = minPf ?? 1;

  if (compliance >= 95 && min >= PF_DRILLDOWN_BANDS.warning) return 'Low';
  if (compliance < 80 || min < PF_DRILLDOWN_BANDS.warning) return 'High';
  return 'Medium';
}

function evaluatePfDrilldownStatus(currentPf) {
  if (currentPf == null || !Number.isFinite(currentPf)) return 'unknown';
  if (currentPf >= PF_DRILLDOWN_BANDS.healthy) return 'healthy';
  if (currentPf >= PF_DRILLDOWN_BANDS.warning) return 'warning';
  return 'critical';
}

function evaluateVoltageStatus(value) {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  if (value >= VOLTAGE_BAND.lower && value <= VOLTAGE_BAND.upper) return 'healthy';
  if (value < VOLTAGE_BAND.lower * 0.95 || value > VOLTAGE_BAND.upper * 1.02) return 'critical';
  return 'warning';
}

function evaluateFrequencyStatus(value) {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  if (value >= FREQUENCY_BAND.lower && value <= FREQUENCY_BAND.upper) return 'healthy';
  return 'warning';
}

function bucketLogsByIstDate(logs, getEnergy) {
  const buckets = new Map();

  logs.forEach((log) => {
    const energy = getEnergy(log);
    if (energy == null || !Number.isFinite(energy)) return;
    const key = formatIstDateKey(log.timestamp);
    if (!buckets.has(key)) {
      buckets.set(key, { date: key, energies: [], timestamps: [] });
    }
    const b = buckets.get(key);
    b.energies.push(energy);
    b.timestamps.push(log.timestamp);
  });

  const daily = [];
  buckets.forEach((b, date) => {
    const first = b.energies[0];
    const last = b.energies[b.energies.length - 1];
    const kwh = first != null && last != null ? Math.max(0, last - first) : 0;
    daily.push({ date, kwh: roundTo(kwh, 2) });
  });

  return daily.sort((a, b) => a.date.localeCompare(b.date));
}

function sumDailyKwhInRange(dailyBuckets, since, until) {
  const sinceMs = since.getTime();
  const untilMs = until.getTime();
  return dailyBuckets
    .filter((d) => {
      const dayStart = istStartUtcFromYMD(
        Number(d.date.slice(0, 4)),
        Number(d.date.slice(5, 7)) - 1,
        Number(d.date.slice(8, 10))
      );
      return dayStart.getTime() >= sinceMs && dayStart.getTime() < untilMs;
    })
    .reduce((s, d) => s + (d.kwh || 0), 0);
}

function computePeakUsageHourToday(logs, getEnergy, todayStart) {
  const todayLogs = logs.filter((log) => new Date(log.timestamp) >= todayStart);
  if (todayLogs.length < 2) return null;

  const hourBuckets = new Map();

  todayLogs.forEach((log) => {
    const energy = getEnergy(log);
    if (energy == null) return;
    const istDate = new Date(log.timestamp.getTime() + IST_OFFSET_MS);
    const hour = istDate.getUTCHours();
    const key = hour;
    if (!hourBuckets.has(key)) {
      hourBuckets.set(key, { hour, energies: [] });
    }
    hourBuckets.get(key).energies.push(energy);
  });

  let best = null;
  hourBuckets.forEach((bucket) => {
    const first = bucket.energies[0];
    const last = bucket.energies[bucket.energies.length - 1];
    const kwh = Math.max(0, last - first);
    if (!best || kwh > best.kwh) {
      const startH = String(bucket.hour).padStart(2, '0');
      const endH = String((bucket.hour + 1) % 24).padStart(2, '0');
      best = { start: `${startH}:00`, end: `${endH}:00`, kwh: roundTo(kwh, 2) };
    }
  });

  return best;
}

function projectMonthEndKwh(monthToDateKwh, daysElapsed, daysInMonth) {
  if (!daysElapsed || daysElapsed <= 0 || monthToDateKwh == null) return null;
  return roundTo((monthToDateKwh / daysElapsed) * daysInMonth, 0);
}

function buildTrendSeries(logs, getEnergy) {
  if (!logs?.length) return [];
  const sorted = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const base = getEnergy(sorted[0]);
  if (base == null) return [];

  return sorted
    .map((log) => {
      const e = getEnergy(log);
      if (e == null) return null;
      return {
        timestamp: log.timestamp,
        consumptionKwh: roundTo(Math.max(0, e - base), 3),
      };
    })
    .filter(Boolean);
}

function getDefaultInsightsConfig() {
  return {
    runningPowerThresholdKw: RUNNING_POWER_THRESHOLD_KW,
    voltageBand: { ...VOLTAGE_BAND },
    pfBands: { ...PF_DRILLDOWN_BANDS },
    frequencyBand: { ...FREQUENCY_BAND },
  };
}

module.exports = {
  CONSUMPTION_PERIOD_DAYS,
  RUNNING_POWER_THRESHOLD_KW,
  RUNNING_GAP_CAP_MS,
  VOLTAGE_BAND,
  PF_DRILLDOWN_BANDS,
  FREQUENCY_BAND,
  roundTo,
  getTodayStartIstUtc,
  getYesterdayStartIstUtc,
  getWeekStartIstUtc,
  getPreviousWeekStartIstUtc,
  getMonthStartIstUtc,
  getPreviousMonthStartIstUtc,
  getDaysInMonthIst,
  getDaysElapsedInMonthIst,
  formatIstDateKey,
  buildComparison,
  countRangeExcursionEvents,
  computeTimeInRangePercent,
  computeTimeBelowPercent,
  computeRunningHours,
  findExtremumPoint,
  computePfCompliance,
  computePenaltyRisk,
  evaluatePfDrilldownStatus,
  evaluateVoltageStatus,
  evaluateFrequencyStatus,
  bucketLogsByIstDate,
  sumDailyKwhInRange,
  computePeakUsageHourToday,
  projectMonthEndKwh,
  buildTrendSeries,
  getDefaultInsightsConfig,
  istStartUtcFromYMD,
};
