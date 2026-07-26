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

function createLogger() {
  if (TEST) return pino({ level: "silent" });

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

  return pino(
    options,
    pino.multistream([
      { level: LEVEL, stream: stdout },
      { level: LEVEL, stream: file },
    ]),
  );
}

const logger = createLogger();

if (PRODUCTION && isCronRunning() === false) {
  logger.warn(
    "cron is not running: log rotation and the 30 day retention window are inactive",
  );
}

export { logger };
