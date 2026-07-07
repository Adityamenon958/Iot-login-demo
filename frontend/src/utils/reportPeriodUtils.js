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

function getWeekStartIstUtc(now = new Date()) {
  const { year, month, day, weekday } = getISTDateComponentsFromUtcDate(now);
  const mondayOffset = weekday === 0 ? 6 : weekday - 1;
  return istStartUtcFromYMD(year, month, day - mondayOffset);
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

function getYearStartIstUtc(now = new Date()) {
  const { year } = getISTDateComponentsFromUtcDate(now);
  return istStartUtcFromYMD(year, 0, 1);
}

function getPreviousYearStartIstUtc(now = new Date()) {
  const { year } = getISTDateComponentsFromUtcDate(now);
  return istStartUtcFromYMD(year - 1, 0, 1);
}

function isSameIstDay(a, b) {
  const da = getISTDateComponentsFromUtcDate(a);
  const db = getISTDateComponentsFromUtcDate(b);
  return da.year === db.year && da.month === db.month && da.day === db.day;
}

export function resolveReportPeriod(periodPreset, now = new Date()) {
  let from;
  let to;
  let isPartial = false;

  switch (periodPreset) {
    case 'last_week':
      from = getPreviousWeekStartIstUtc(now);
      to = new Date(getWeekStartIstUtc(now).getTime() - 1);
      break;
    case 'current_week':
      from = getWeekStartIstUtc(now);
      to = now;
      isPartial = true;
      break;
    case 'previous_month':
      from = getPreviousMonthStartIstUtc(now);
      to = new Date(getMonthStartIstUtc(now).getTime() - 1);
      break;
    case 'current_month':
      from = getMonthStartIstUtc(now);
      to = now;
      isPartial = true;
      break;
    case 'previous_year':
      from = getPreviousYearStartIstUtc(now);
      to = new Date(getYearStartIstUtc(now).getTime() - 1);
      break;
    case 'current_year':
      from = getYearStartIstUtc(now);
      to = now;
      isPartial = true;
      break;
    default:
      from = getWeekStartIstUtc(now);
      to = now;
      isPartial = true;
  }

  return { from, to, isPartial, timezone: IST_TZ };
}

function formatIstDate(date) {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: IST_TZ,
  });
}

function formatIstTime(date) {
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: IST_TZ,
  });
}

export function formatReportPeriodRange(periodPreset, now = new Date()) {
  const { from, to, isPartial } = resolveReportPeriod(periodPreset, now);

  if (isSameIstDay(from, to)) {
    if (isPartial) {
      return `${formatIstDate(from)}, ${formatIstTime(from)} – ${formatIstTime(to)} (IST)`;
    }
    return `${formatIstDate(from)} (IST)`;
  }

  const endLabel = isPartial
    ? `${formatIstDate(to)}, ${formatIstTime(to)} (till now)`
    : formatIstDate(to);

  return `${formatIstDate(from)} – ${endLabel} (IST)`;
}
