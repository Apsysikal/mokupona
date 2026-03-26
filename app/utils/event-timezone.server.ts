import { offsetDate } from "./misc";

/** The canonical timezone used for all event dates displayed to users. */
export const EVENT_TIMEZONE = "Europe/Zurich";

export type ClientHints = {
  userTimezone: string;
  userTimezoneOffset: number;
};

/**
 * Return timezone offset in minutes for `timeZone` at the provided instant.
 * Positive values are east of UTC (e.g. Europe/Zurich winter => 60).
 */
function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  // Use a fixed Latin-digit locale so Number(...) parsing is deterministic.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => {
      return part.type === type;
    })?.value;

    if (!value) throw new Error(`Missing ${type} for timezone ${timeZone}`);

    return Number(value);
  };

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const second = getPart("second");

  // Date.UTC expects a zero-based month (January = 0), so subtract 1.
  const tzAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);

  return (tzAsUtc - date.getTime()) / (60 * 1000);
}

/**
 * Convert a user-supplied date (expressed in the user's browser timezone) to
 * UTC so it can be stored correctly in the database.
 */
export function toUtcEventDate(date: Date, clientHints: ClientHints): Date {
  const eventOffset = getTimezoneOffsetMinutes(date, EVENT_TIMEZONE);
  return offsetDate(date, -eventOffset);
}

/**
 * Convert a UTC date retrieved from the database back to a datetime-local
 * string (YYYY-MM-DDTHH:mm) that a browser `<input type="datetime-local">`
 * can display in the user's timezone.
 */
export function toDisplayEventDate(date: Date, clientHints: ClientHints): string {
  const eventOffset = getTimezoneOffsetMinutes(date, EVENT_TIMEZONE);
  return offsetDate(date, eventOffset)
    .toISOString()
    .substring(0, 16);
}
