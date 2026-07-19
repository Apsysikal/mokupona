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
  test("round-trips a stored UTC instant", () => {
    const original = new Date("2024-06-15T19:00:00.000Z");
    const displayStr = toDisplayEventDate(original);
    const roundTripped = toUtcEventDate(displayStr);
    expect(roundTripped.toISOString()).toBe(original.toISOString());
  });

  test("toUtcEventDate converts a datetime-local value to the Zurich UTC instant", () => {
    expect(toUtcEventDate("2024-06-15T21:00").toISOString()).toBe(
      "2024-06-15T19:00:00.000Z",
    );
  });

  test("toDisplayEventDate returns a datetime-local compatible string", () => {
    const date = new Date("2024-06-15T19:00:00.000Z");
    const result = toDisplayEventDate(date);
    // Must match YYYY-MM-DDTHH:mm exactly
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  test("toUtcEventDate produces a Date instance", () => {
    const result = toUtcEventDate("2024-06-15T19:00");
    expect(result).toBeInstanceOf(Date);
  });

  test("toUtcEventDate rejects a value that is not datetime-local", () => {
    expect(() => toUtcEventDate("15.06.2024 19:00")).toThrow(
      "Not a datetime-local value",
    );
  });

  test("Europe/Zurich winter (CET): 18:00 local converts to 17:00Z", () => {
    const utc = toUtcEventDate("2024-12-10T18:00");

    expect(utc.toISOString()).toBe("2024-12-10T17:00:00.000Z");
  });

  test("Europe/Zurich summer (CEST): 18:00 local converts to 16:00Z", () => {
    const utc = toUtcEventDate("2024-06-10T18:00");

    expect(utc.toISOString()).toBe("2024-06-10T16:00:00.000Z");
  });

  test("Zurich spring-forward gap: the nonexistent 02:30 resolves past the gap, independent of server timezone", () => {
    // 2025-03-30 02:00–03:00 does not exist in Zurich (CET -> CEST). The
    // wall clock is read off the string, so a server in a DST-observing zone
    // no longer shifts it; the offset iteration settles on 01:30Z (03:30
    // CEST) deterministically.
    const utc = toUtcEventDate("2025-03-30T02:30");

    expect(utc.toISOString()).toBe("2025-03-30T01:30:00.000Z");
  });

  test("Europe/Zurich winter (CET): 17:00Z displays as 18:00", () => {
    const storedUtcDate = new Date("2024-12-10T17:00:00.000Z");

    expect(toDisplayEventDate(storedUtcDate)).toBe("2024-12-10T18:00");
  });

  test("Europe/Zurich summer (CEST): 16:00Z displays as 18:00", () => {
    const storedUtcDate = new Date("2024-06-10T16:00:00.000Z");

    expect(toDisplayEventDate(storedUtcDate)).toBe("2024-06-10T18:00");
  });

  test("Europe/Zurich fall-back boundary: 00:30Z displays as 02:30", () => {
    const storedUtcDate = new Date("2024-10-27T00:30:00.000Z");

    expect(toDisplayEventDate(storedUtcDate)).toBe("2024-10-27T02:30");
  });
});
