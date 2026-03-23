import { describe, expect, test } from "vitest";

import {
  EVENT_TIMEZONE,
  toDisplayEventDate,
  toUtcEventDate,
} from "./event-timezone.server";

describe("EVENT_TIMEZONE", () => {
  test("is Europe/Zurich", () => {
    expect(EVENT_TIMEZONE).toBe("Europe/Zurich");
  });
});

/**
 * Round-trip tests: a date stored as UTC must come back as the original display
 * string after passing through both conversion functions.
 */
describe("toUtcEventDate / toDisplayEventDate round-trip", () => {
  test("round-trips for a UTC user (offset 0)", () => {
    const clientHints = { userTimezone: "UTC", userTimezoneOffset: 0 };
    const original = new Date("2024-06-15T19:00:00.000Z");
    const displayStr = toDisplayEventDate(original, clientHints);
    const roundTripped = toUtcEventDate(new Date(displayStr), clientHints);
    expect(roundTripped.toISOString()).toBe(original.toISOString());
  });

  test("toDisplayEventDate returns a datetime-local compatible string", () => {
    const clientHints = { userTimezone: "UTC", userTimezoneOffset: 0 };
    const date = new Date("2024-06-15T19:00:00.000Z");
    const result = toDisplayEventDate(date, clientHints);
    // Must match YYYY-MM-DDTHH:mm exactly
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  test("toUtcEventDate produces a Date instance", () => {
    const clientHints = { userTimezone: "UTC", userTimezoneOffset: 0 };
    const result = toUtcEventDate(new Date("2024-06-15T19:00:00.000Z"), clientHints);
    expect(result).toBeInstanceOf(Date);
  });
});
