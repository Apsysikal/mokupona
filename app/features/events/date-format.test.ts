import { describe, expect, it } from "vitest";

import {
  formatAdminDateLine,
  formatAdminTimestamp,
  formatAdminToday,
  formatEventDateLine,
  formatEventDayMonth,
  formatEventMonthYear,
} from "./date-format";

describe("event date formatting", () => {
  it("formats every fixed event/admin shape in the event timezone", () => {
    const date = new Date("2026-07-12T17:30:00.000Z");

    expect(formatEventDateLine(date, "long")).toBe("sunday 12 july · 19:30");
    expect(formatEventDateLine(date, "short")).toBe("sun 12 july · 19:30");
    expect(formatAdminDateLine(date)).toBe("Sun, 12 Jul 2026 · 19:30");
    expect(formatAdminTimestamp(date)).toBe("12 Jul, 19:30");
    expect(formatEventMonthYear(date)).toBe("jul 2026");
    expect(formatEventDayMonth(date)).toBe("12 july");
    expect(formatAdminToday(date)).toBe("Sunday 12 July");
  });
});
