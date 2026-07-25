// Client-safe: dinner-card/dinner-view render these formatters in the browser.

import { EVENT_TIMEZONE } from "./timezone";

// The redesign writes all dates in a fixed, lowercase, Zurich-local shape
// ("saturday 9 may · 19:00"); a fixed locale keeps server and client render
// identical. Lowercasing happens here, not via CSS, so no caller can forget.
const eventTimeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: EVENT_TIMEZONE,
});

const longDayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: EVENT_TIMEZONE,
});

const eventShortDayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "long",
  timeZone: EVENT_TIMEZONE,
});

const adminDateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: EVENT_TIMEZONE,
});

const adminTimestampDayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: EVENT_TIMEZONE,
});

const eventMonthYearFormat = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
  timeZone: EVENT_TIMEZONE,
});

const eventDayMonthFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: EVENT_TIMEZONE,
});

/** "saturday 9 may · 19:00" (weekday: "long") / "sat 9 may · 19:00" ("short") */
export function formatEventDateLine(date: Date, weekday: "long" | "short") {
  const dayLine =
    weekday === "long"
      ? longDayFormat.format(date)
      : eventShortDayFormat.format(date);

  return `${dayLine} · ${eventTimeFormat.format(date)}`.toLowerCase();
}

/** "Sun, 12 Jul 2026 · 19:30" — admin meta lines keep their casing */
export function formatAdminDateLine(date: Date) {
  const dayLine = adminDateFormat.format(date);

  return `${dayLine} · ${eventTimeFormat.format(date)}`;
}

/** "2 Jul, 14:22" — admin signup timestamps */
export function formatAdminTimestamp(date: Date) {
  const dayMonth = adminTimestampDayFormat.format(date);

  return `${dayMonth}, ${eventTimeFormat.format(date)}`;
}

/** "apr 2026" — archive labels on past dinner cards */
export function formatEventMonthYear(date: Date) {
  return eventMonthYearFormat.format(date).toLowerCase();
}

/** "9 may" — the landing hero eyebrow */
export function formatEventDayMonth(date: Date) {
  return eventDayMonthFormat.format(date).toLowerCase();
}

/** "Sunday 12 July" — admin overview eyebrow. */
export function formatAdminToday(date: Date) {
  return longDayFormat.format(date);
}
