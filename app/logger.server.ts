import os from "node:os";
import path from "node:path";

import pino from "pino";
import pretty from "pino-pretty";

import { isCronRunning } from "~/logger/cron-check.server";
import { redact } from "~/logger/redact.server";

const PRODUCTION = process.env.NODE_ENV === "production";
const TEST = process.env.NODE_ENV === "test";
const LEVEL = process.env.LOG_LEVEL ?? (PRODUCTION ? "info" : "debug");
const LOG_DIR = process.env.LOG_DIR ?? path.join(os.tmpdir(), "mokupona-logs");

const options = {
  level: LEVEL,
  redact,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label: string) => ({ level: label }) },
  serializers: { error: pino.stdSerializers.err },
};

// pino-pretty hands back a plain Transform, which has no flushSync
type MaybeFlushable = { flushSync?: () => void };

function flushStream(stream: object) {
  try {
    (stream as MaybeFlushable).flushSync?.();
    return true;
  } catch {
    // "sonic boom is not ready yet" — the file has not finished opening
    return false;
  }
}

function createLogger() {
  if (TEST) return { logger: pino({ level: "silent" }), flush: () => true };

  const stdout = PRODUCTION
    ? pino.destination(1)
    : pretty({
        colorize: true,
        translateTime: "SYS:HH:MM:ss.l",
        ignore: "pid,hostname",
      });

  const file = pino.destination({
    dest: path.join(LOG_DIR, "app.log"),
    append: true,
    mkdir: true,
  });

  return {
    logger: pino(
      options,
      pino.multistream([
        { level: LEVEL, stream: stdout },
        { level: LEVEL, stream: file },
      ]),
    ),
    flush: () => {
      const stdoutFlushed = flushStream(stdout);
      const fileFlushed = flushStream(file);
      return stdoutFlushed && fileFlushed;
    },
  };
}

const { logger, flush } = createLogger();

// long enough for a sink that was still opening to finish and drain, far
// shorter than fly.toml's 5 s kill_timeout
const DRAIN_GRACE_MS = 250;

let closing = false;

function shutdown(signal: NodeJS.Signals) {
  if (closing) return;
  closing = true;
  logger.info({ signal }, "shutting down");

  if (flush()) {
    process.exit(0);
    return;
  }

  // A signal within the first milliseconds of a process, before the file sink
  // finished opening. Exiting now would lose the buffered lines and rethrow out
  // of pino's own exit hook, so let the sink open and write them first. The
  // timer is unref'd — a script with nothing left to do still exits at once —
  // and it must exist at all because an event loop held open by a listening
  // server would otherwise ignore this signal and every one after it.
  process.exitCode = 0;
  setTimeout(() => {
    flush();
    process.exit(0);
  }, DRAIN_GRACE_MS).unref();
}

if (!TEST) {
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

if (PRODUCTION && isCronRunning() === false) {
  logger.warn(
    "cron is not running: log rotation and the 30 day retention window are inactive",
  );
}

export { logger };
