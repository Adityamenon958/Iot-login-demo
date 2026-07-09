const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const IST_TZ = 'Asia/Kolkata';

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
  return istStartUtcFromYMD(year, month, day - mondayOffset);
}

function getMonthStartIstUtc(now = new Date()) {
  const { year, month } = getISTDateComponentsFromUtcDate(now);
  return istStartUtcFromYMD(year, month, 1);
}

function getDaysInMonthIst(now = new Date()) {
  const { year, month } = getISTDateComponentsFromUtcDate(now);
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function getMonthEndIstUtc(now = new Date()) {
  const { year, month } = getISTDateComponentsFromUtcDate(now);
  return istStartUtcFromYMD(year, month, getDaysInMonthIst(now));
}

function formatShortIstDate(date) {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: IST_TZ,
  });
}

function formatMonthYearIst(date) {
  return date.toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
    timeZone: IST_TZ,
  });
}

function formatIstRange(from, to, { partial = false } = {}) {
  const fromLabel = formatShortIstDate(from);
  const toLabel = formatShortIstDate(to);
  if (fromLabel === toLabel) {
    return partial ? `${fromLabel} · till now` : fromLabel;
  }
  if (partial) {
    return `${fromLabel} – ${toLabel} · till now`;
  }
  return `${fromLabel} – ${toLabel}`;
}

export function buildConsumptionSummaryDateHints(period = '7d', now = new Date()) {
  const periodDays = period === '30d' ? 30 : 7;
  const todayStart = getTodayStartIstUtc(now);
  const yesterdayStart = getYesterdayStartIstUtc(now);
  const weekStart = getWeekStartIstUtc(now);
  const monthStart = getMonthStartIstUtc(now);
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const monthEnd = getMonthEndIstUtc(now);

  return {
    today: formatIstRange(todayStart, now, { partial: true }),
    yesterday: formatShortIstDate(yesterdayStart),
    week: formatIstRange(weekStart, now, { partial: true }),
    month: formatIstRange(monthStart, now, { partial: true }),
    periodTotal: formatIstRange(periodStart, now, { partial: true }),
    avgDaily: period === '30d' ? '30-day average' : '7-day average',
    projected: `by ${formatShortIstDate(monthEnd)}`,
    register: formatMonthYearIst(now),
  };
}
