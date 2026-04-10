import { format as fnsFormat } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Get user's preferred timezone from localStorage, fallback to Europe/Paris.
 */
export function getUserTimezone(): string {
  try {
    const stored = localStorage.getItem('app_timezone');
    if (stored) return stored;
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  } catch {
    return 'Europe/Paris';
  }
}

/**
 * Format a date with French locale, timezone-aware display.
 */
export function formatTz(
  date: Date | string | number,
  formatStr: string,
  opts?: { locale?: Locale }
): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return fnsFormat(d, formatStr, { locale: opts?.locale || fr });
}

export { formatTz as format };

/**
 * Check if a date is today in user's timezone.
 */
export function isTodayUserTz(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const tz = getUserTimezone();
  const dStr = d.toLocaleDateString('en-CA', { timeZone: tz });
  const nowStr = now.toLocaleDateString('en-CA', { timeZone: tz });
  return dStr === nowStr;
}

/**
 * Check if two dates are the same day in user's timezone.
 */
export function isSameDayUserTz(date1: Date, date2: Date): boolean {
  const tz = getUserTimezone();
  const d1 = date1.toLocaleDateString('en-CA', { timeZone: tz });
  const d2 = date2.toLocaleDateString('en-CA', { timeZone: tz });
  return d1 === d2;
}
