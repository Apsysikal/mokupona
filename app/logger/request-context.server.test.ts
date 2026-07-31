import type { Logger } from "pino";
import { describe, expect, it, vi, type Mock } from "vitest";

import { loggerStub } from "../../test/logger-stub";

import { requestLogger, withRequestLogger } from "./request-context.server";

function fakeLogger() {
  return { info: vi.fn() } as unknown as Logger & { info: Mock };
}

describe("request logger storage", () => {
  it("falls back to the process logger outside a request", () => {
    requestLogger.info("outside a request");

    expect(loggerStub.info).toHaveBeenCalledWith("outside a request");
  });

  it("stays in scope across await points and unwinds after", async () => {
    const scoped = fakeLogger();

    await withRequestLogger(scoped, async () => {
      await Promise.resolve();
      requestLogger.info("during the request");
    });

    expect(scoped.info).toHaveBeenCalledWith("during the request");
    expect(loggerStub.info).not.toHaveBeenCalled();

    requestLogger.info("after the request");
    expect(loggerStub.info).toHaveBeenCalledWith("after the request");
  });

  it("keeps concurrent requests apart", async () => {
    const first = fakeLogger();
    const second = fakeLogger();

    await Promise.all([
      withRequestLogger(first, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        requestLogger.info("from the first");
      }),
      withRequestLogger(second, async () => {
        requestLogger.info("from the second");
      }),
    ]);

    expect(first.info).toHaveBeenCalledWith("from the first");
    expect(second.info).toHaveBeenCalledWith("from the second");
  });

  it("calls a level method on the logger it came from", async () => {
    const scoped = fakeLogger();

    await withRequestLogger(scoped, async () => {
      requestLogger.info("during the request");
    });

    expect(scoped.info.mock.contexts[0]).toBe(scoped);
  });
});
