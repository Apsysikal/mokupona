import { vi } from "vitest";

const levels = ["trace", "debug", "info", "warn", "error", "fatal"] as const;

export type LoggerStub = Record<
  (typeof levels)[number] | "child",
  ReturnType<typeof vi.fn>
>;

function createLoggerStub(): LoggerStub {
  const stub = Object.fromEntries(
    levels.map((level) => [level, vi.fn()]),
  ) as LoggerStub;
  stub.child = vi.fn(() => stub);
  return stub;
}

export const loggerStub = createLoggerStub();

export function resetLoggerStub() {
  for (const level of levels) loggerStub[level].mockClear();
  loggerStub.child.mockClear();
}
