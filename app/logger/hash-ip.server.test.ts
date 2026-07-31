import { afterEach, describe, expect, it, vi } from "vitest";

import { hashIp } from "./hash-ip.server";

const DAY_MS = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
});

describe("hashIp", () => {
  it("returns 16 base64url characters", () => {
    expect(hashIp("203.0.113.9")).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });

  it("hashes the same address to the same value within an epoch", () => {
    expect(hashIp("203.0.113.9")).toBe(hashIp("203.0.113.9"));
  });

  it("hashes different addresses to different values", () => {
    expect(hashIp("203.0.113.9")).not.toBe(hashIp("203.0.113.10"));
  });

  it("handles IPv6 addresses", () => {
    expect(hashIp("2001:db8::1")).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(hashIp("2001:db8::1")).not.toBe(hashIp("2001:db8::2"));
  });

  it("hashes the same address differently once the salt rotates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T09:00:00.000Z"));
    const before = hashIp("203.0.113.9");

    vi.setSystemTime(new Date("2026-07-26T09:00:00.000Z").getTime() + DAY_MS);
    const after = hashIp("203.0.113.9");

    expect(after).not.toBe(before);
    expect(after).toBe(hashIp("203.0.113.9"));
  });
});
