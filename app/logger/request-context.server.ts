import { AsyncLocalStorage } from "node:async_hooks";

import type { Logger } from "pino";

import { logger } from "~/logger.server";
import { singleton } from "~/utils/singleton.server";

const storage = singleton(
  "requestLoggerStorage",
  () => new AsyncLocalStorage<Logger>(),
);

/** Make `scoped` the ambient logger for everything `run` awaits. */
export function withRequestLogger<T>(scoped: Logger, run: () => T): T {
  return storage.run(scoped, run);
}

/**
 * The request-scoped child logger, correlated by `requestId`, falling back to
 * the process logger outside a request. This is the correlation route for the
 * modules the router's context API does not reach — `app/models/*`, mail,
 * image storage, the auth guards.
 */
export const requestLogger = new Proxy({} as Logger, {
  get(_target, property) {
    const current = storage.getStore() ?? logger;
    const value = Reflect.get(current, property, current);
    return typeof value === "function" ? value.bind(current) : value;
  },
});
