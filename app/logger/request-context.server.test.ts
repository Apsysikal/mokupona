import type { Logger } from "pino";
import { describe, expect, it } from "vitest";

import { requestLogger, withRequestLogger } from "./request-context.server";

import { logger } from "~/logger.server";

function fakeLogger() {
  return {} as Logger;
}

describe("request logger storage", () => {
  it("falls back to the process logger outside a request", () => {
    expect(requestLogger()).toBe(logger);
  });

  it("stays in scope across await points and unwinds after", async () => {
    const scoped = fakeLogger();

    const seen = await withRequestLogger(scoped, async () => {
      await Promise.resolve();
      return requestLogger();
    });

    expect(seen).toBe(scoped);
    expect(requestLogger()).toBe(logger);
  });

  it("keeps concurrent requests apart", async () => {
    const first = fakeLogger();
    const second = fakeLogger();

    const [a, b] = await Promise.all([
      withRequestLogger(first, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return requestLogger();
      }),
      withRequestLogger(second, async () => requestLogger()),
    ]);

    expect(a).toBe(first);
    expect(b).toBe(second);
  });
});
