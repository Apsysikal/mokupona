import { describe, expect, it } from "vitest";

import { orderEventsByStatus, partitionEvents } from "./event-status";

const now = new Date("2026-07-12T12:00:00.000Z");

describe("event status ordering", () => {
  it("orders upcoming soonest-first and past newest-first", () => {
    const events = [
      { id: "past-older", date: "2026-07-10T12:00:00.000Z" },
      { id: "future-later", date: "2026-07-14T12:00:00.000Z" },
      { id: "past-newer", date: "2026-07-11T12:00:00.000Z" },
      { id: "boundary", date: now.toISOString() },
      { id: "future-sooner", date: "2026-07-13T12:00:00.000Z" },
    ];

    expect(orderEventsByStatus(events, now).map(({ id }) => id)).toEqual([
      "boundary",
      "future-sooner",
      "future-later",
      "past-newer",
      "past-older",
    ]);
    expect(events.map(({ id }) => id)).toEqual([
      "past-older",
      "future-later",
      "past-newer",
      "boundary",
      "future-sooner",
    ]);
  });

  it("treats an event exactly on now as upcoming", () => {
    const { upcoming, past } = partitionEvents(
      [
        { id: "past", date: new Date(now.getTime() - 1) },
        { id: "boundary", date: now },
      ],
      now,
    );

    expect(upcoming.map(({ id }) => id)).toEqual(["boundary"]);
    expect(past.map(({ id }) => id)).toEqual(["past"]);
  });

  it("preserves input order for equal dates", () => {
    const date = "2026-07-13T12:00:00.000Z";
    const events = [
      { id: "first", date },
      { id: "second", date },
    ];

    expect(orderEventsByStatus(events, now).map(({ id }) => id)).toEqual([
      "first",
      "second",
    ]);
  });
});
