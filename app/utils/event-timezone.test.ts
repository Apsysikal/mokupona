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
    const original = new Date("2024-06-15T19:00:00.000Z");
    const displayStr = toDisplayEventDate(original);
    const roundTripped = toUtcEventDate(new Date(displayStr));
    expect(roundTripped.toISOString()).toBe(original.toISOString());
  });

  test("toDisplayEventDate returns a datetime-local compatible string", () => {
    const date = new Date("2024-06-15T19:00:00.000Z");
    const result = toDisplayEventDate(date);
    // Must match YYYY-MM-DDTHH:mm exactly
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  test("toUtcEventDate produces a Date instance", () => {
    const result = toUtcEventDate(new Date("2024-06-15T19:00:00.000Z"));
    expect(result).toBeInstanceOf(Date);
  });

  test("converts winter (CET) times for Europe/Zurich correctly", () => {
    // datetime-local submission (no timezone suffix) interpreted in EVENT_TIMEZONE
    const displayDate = new Date("2024-12-05T18:00:00");
    const roundTripped = toUtcEventDate(displayDate);
    expect(roundTripped.toISOString()).toBe("2024-12-05T17:00:00.000Z");

    const backToDisplay = toDisplayEventDate(roundTripped);
    expect(backToDisplay).toBe("2024-12-05T18:00");
  });

  test("converts summer (CEST) times for Europe/Zurich correctly", () => {
    const displayDate = new Date("2024-07-10T18:00:00");
    const roundTripped = toUtcEventDate(displayDate);
    expect(roundTripped.toISOString()).toBe("2024-07-10T16:00:00.000Z");

    const backToDisplay = toDisplayEventDate(roundTripped);
    expect(backToDisplay).toBe("2024-07-10T18:00");
  });
});
