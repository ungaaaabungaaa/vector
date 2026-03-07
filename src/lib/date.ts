import { format, parseISO, formatDistanceToNow } from 'date-fns';

/**
 * Canonical ISO date-only pattern used by Postgres `date` columns.
 * Keep this centralised so we don't sprinkle raw strings across the code-base.
 */
export const DATE_PATTERN = 'yyyy-MM-dd' as const;

/**
 * Converts any supported input to a `Date` instance in UTC.
 */
export function toDate(input?: Date | string | null): Date | undefined {
  if (!input) return undefined;
  return input instanceof Date ? input : parseISO(input);
}

/**
 * Formats a `Date | string | null` into `YYYY-MM-DD` (UTC) for safe storage in
 * Postgres `date` columns. Returns `undefined` if input is nullish.
 */
export function formatDateForDb(
  input?: Date | string | null,
): string | undefined {
  const date = toDate(input);
  return date ? format(date, DATE_PATTERN) : undefined;
}

/**
 * Formats a date in human-readable relative format (e.g., "2 days ago").
 * Falls back to absolute format for dates older than 30 days.
 */
export function formatDateHuman(input?: Date | string | null): string {
  const date = toDate(input);
  if (!date) return '—';

  try {
    // For dates older than 30 days, show absolute date
    const daysDiff =
      Math.abs(Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 30) {
      return format(date, 'MMM d, yyyy');
    }

    // Otherwise show relative time
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return format(date, 'MMM d, yyyy');
  }
}
