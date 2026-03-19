import { offsetDate } from "./misc";

/** The canonical timezone used for all event dates displayed to users. */
export const EVENT_TIMEZONE = "Europe/Zurich";

export type ClientHints = {
  userTimezone: string;
  userTimezoneOffset: number;
};

/**
 * Return the minute-offset between EVENT_TIMEZONE and the user's local timezone
 * for the given date (DST-aware).
 */
function getTimezoneOffsetMinutes(date: Date, userTimezone: string): number {
  const eventTs = Date.parse(
    date.toLocaleString(undefined, { timeZone: EVENT_TIMEZONE }),
  );
  const userTs = Date.parse(
    date.toLocaleString(undefined, { timeZone: userTimezone }),
  );
  return (eventTs - userTs) / (60 * 1000);
}

/**
 * Convert a user-supplied date (expressed in the user's browser timezone) to
 * UTC so it can be stored correctly in the database.
 */
export function toUtcEventDate(date: Date, clientHints: ClientHints): Date {
  const diff = getTimezoneOffsetMinutes(date, clientHints.userTimezone);
  return offsetDate(date, -(diff + clientHints.userTimezoneOffset));
}

/**
 * Convert a UTC date retrieved from the database back to a datetime-local
 * string (YYYY-MM-DDTHH:mm) that a browser `<input type="datetime-local">`
 * can display in the user's timezone.
 */
export function toDisplayEventDate(date: Date, clientHints: ClientHints): string {
  const diff = getTimezoneOffsetMinutes(date, clientHints.userTimezone);
  return offsetDate(date, diff + clientHints.userTimezoneOffset)
    .toISOString()
    .substring(0, 16);
}
