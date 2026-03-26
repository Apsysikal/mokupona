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
 * Return the minute-offset between EVENT_TIMEZONE and UTC for the given date.
 * This is DST-aware and solely depends on the event's canonical timezone,
 * ensuring that we always convert using the offset applicable on the event
 * date rather than the user's current offset (which may belong to a different
 * DST period).
 */
function getEventOffsetFromUtc(date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  const eventIso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`;

  const eventTs = Date.parse(eventIso);
  const utcTs = date.getTime();

  return (eventTs - utcTs) / (60 * 1000);
}

/**
 * Convert a user-supplied date to UTC so it can be stored correctly.
 *
 * All events are anchored to the canonical EVENT_TIMEZONE; we deliberately
 * ignore the client's current timezone/offset because those cookies may belong
 * to a different DST period than the event date. We only need the event zone's
 * offset at the specific event date.
 */
export function toUtcEventDate(date: Date): Date {
  const eventOffset = getEventOffsetFromUtc(date);
  return offsetDate(date, -eventOffset);
}

/**
 * Convert a UTC date retrieved from the database back to a datetime-local
 * string (YYYY-MM-DDTHH:mm) that a browser `<input type="datetime-local">`
 * can display. We always display dinners in EVENT_TIMEZONE.
 */
export function toDisplayEventDate(date: Date): string {
  const eventOffset = getEventOffsetFromUtc(date);
  return offsetDate(date, eventOffset)
    .toISOString()
    .substring(0, 16);
}
