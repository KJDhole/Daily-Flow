/**
 * Time and date helper utilities with timezone support.
 * Default timezone: Asia/Shanghai (UTC+8)
 */

export const DEFAULT_TIMEZONE = process.env.TZ || 'Asia/Shanghai';

/**
 * Returns today's date string YYYY-MM-DD in the target timezone
 */
export function getTodayDate(timezone: string = DEFAULT_TIMEZONE): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now); // en-CA gives YYYY-MM-DD
}

/**
 * Formats a Date object or timestamp into YYYY-MM-DD in the target timezone
 */
export function formatDateStr(dateInput: Date | string | number, timezone: string = DEFAULT_TIMEZONE): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return getTodayDate(timezone);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Returns human-readable date & time in the target timezone (e.g. "2026-10-13 15:30:00")
 */
export function formatDateTimeStr(dateInput: Date | string | number, timezone: string = DEFAULT_TIMEZONE): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return formatter.format(d).replace(/\//g, '-');
}

/**
 * Calculate natural calendar days between two YYYY-MM-DD dates inclusive.
 * e.g. 2026-10-13 to 2026-10-16 -> 4 natural days (13, 14, 15, 16)
 */
export function calculateNaturalDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 1;
  const start = new Date(`${startDateStr}T00:00:00Z`).getTime();
  const end = new Date(`${endDateStr}T00:00:00Z`).getTime();
  const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

/**
 * Calculate carry-over days between initial planned date and current/today date.
 * If initial was 2026-10-12 and today is 2026-10-13 -> 1 day carried over.
 */
export function calculateCarryOverDays(initialDateStr: string, currentDateStr: string): number {
  if (!initialDateStr || !currentDateStr) return 0;
  const start = new Date(`${initialDateStr}T00:00:00Z`).getTime();
  const current = new Date(`${currentDateStr}T00:00:00Z`).getTime();
  const diffDays = Math.round((current - start) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}
