import { EVENT_TIMEZONE } from "./timezone";

// re-exported so the timezone stays importable next to the converters
export { EVENT_TIMEZONE };

function offsetDate(date: Date, minutesOffset = 0): Date {
  return new Date(date.getTime() + minutesOffset * 60 * 1000);
}

// Fixed to the application event timezone; constructing this formatter is
// comparatively expensive and conversion may call it twice around DST edges.
const eventTimezonePartsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIMEZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * Return the event-timezone offset in minutes at the provided instant.
 * Positive values are east of UTC (e.g. Europe/Zurich winter => 60).
 */
function getTimezoneOffsetMinutes(date: Date): number {
  const parts = eventTimezonePartsFormat.formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => {
      return part.type === type;
    })?.value;

    if (!value)
      throw new Error(`Missing ${type} for timezone ${EVENT_TIMEZONE}`);

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

const DATETIME_LOCAL_VALUE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

/**
 * Convert a `datetime-local` value into UTC for storage in the database while
 * treating the wall-clock value as being in `EVENT_TIMEZONE`.
 */
export function toUtcEventDate(value: string): Date {
  // `datetime-local` inputs encode a wall-clock date/time without timezone
  // information. Read the components straight off the string — routing it
  // through `new Date()` first would interpret it in the server's local
  // timezone, which is lossy inside that zone's DST spring-forward gap.
  const match = DATETIME_LOCAL_VALUE.exec(value);
  if (!match) {
    throw new Error(`Not a datetime-local value: ${value}`);
  }
  const [, year, month, day, hour, minute, second, millisecond] = match;

  // Date.UTC expects a zero-based month (January = 0), so subtract 1.
  const localDateTimeAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? "0"),
    Number((millisecond ?? "0").padEnd(3, "0")),
  );

  let utcTimestamp = localDateTimeAsUtc;

  // Recompute once after applying the offset so DST edges settle on the
  // correct instant for the event timezone.
  for (let iteration = 0; iteration < 2; iteration++) {
    const eventOffset = getTimezoneOffsetMinutes(new Date(utcTimestamp));
    const adjustedUtcTimestamp = localDateTimeAsUtc - eventOffset * 60 * 1000;

    if (adjustedUtcTimestamp === utcTimestamp) break;
    utcTimestamp = adjustedUtcTimestamp;
  }

  return new Date(utcTimestamp);
}

/**
 * Convert a UTC date retrieved from the database back to a datetime-local
 * string (YYYY-MM-DDTHH:mm) that a browser `<input type="datetime-local">`
 * can display in the user's timezone.
 */
export function toDisplayEventDate(date: Date): string {
  const eventOffset = getTimezoneOffsetMinutes(date);
  return offsetDate(date, eventOffset).toISOString().substring(0, 16);
}
