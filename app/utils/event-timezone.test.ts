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

  test("toUtcEventDate converts a datetime-local value to the Zurich UTC instant", () => {
    const clientHints = { userTimezone: "UTC", userTimezoneOffset: 0 };
    const datetimeLocalAsDate = new Date("2024-06-15T21:00");

    expect(toUtcEventDate(datetimeLocalAsDate, clientHints).toISOString()).toBe(
      "2024-06-15T19:00:00.000Z",
    );
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

  test("Europe/Zurich winter (CET): 18:00 local converts to 17:00Z", () => {
    const clientHints = {
      userTimezone: "Europe/Zurich",
      userTimezoneOffset: 60,
    };
    const datetimeLocalAsDate = new Date("2024-12-10T18:00");
    const utc = toUtcEventDate(datetimeLocalAsDate, clientHints);

    expect(utc.toISOString()).toBe("2024-12-10T17:00:00.000Z");
  });

  test("Europe/Zurich summer (CEST): 18:00 local converts to 16:00Z", () => {
    const clientHints = {
      userTimezone: "Europe/Zurich",
      userTimezoneOffset: 120,
    };
    const datetimeLocalAsDate = new Date("2024-06-10T18:00");
    const utc = toUtcEventDate(datetimeLocalAsDate, clientHints);

    expect(utc.toISOString()).toBe("2024-06-10T16:00:00.000Z");
  });

  test("Europe/Zurich winter (CET): 17:00Z displays as 18:00", () => {
    const clientHints = {
      userTimezone: "Europe/Zurich",
      userTimezoneOffset: 60,
    };
    const storedUtcDate = new Date("2024-12-10T17:00:00.000Z");

    expect(toDisplayEventDate(storedUtcDate, clientHints)).toBe("2024-12-10T18:00");
  });

  test("Europe/Zurich summer (CEST): 16:00Z displays as 18:00", () => {
    const clientHints = {
      userTimezone: "Europe/Zurich",
      userTimezoneOffset: 120,
    };
    const storedUtcDate = new Date("2024-06-10T16:00:00.000Z");

    expect(toDisplayEventDate(storedUtcDate, clientHints)).toBe("2024-06-10T18:00");
  });

  test("Europe/Zurich fall-back boundary: 00:30Z displays as 02:30", () => {
    const clientHints = {
      userTimezone: "Europe/Zurich",
      userTimezoneOffset: 120,
    };
    const storedUtcDate = new Date("2024-10-27T00:30:00.000Z");

    expect(toDisplayEventDate(storedUtcDate, clientHints)).toBe("2024-10-27T02:30");
  });
});
