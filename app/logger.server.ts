import pino from "pino";
import pretty from "pino-pretty";

const PRODUCTION = process.env.NODE_ENV === "production";
const TEST = process.env.NODE_ENV === "test";
const LEVEL = process.env.LOG_LEVEL ?? (PRODUCTION ? "info" : "debug");

const options = {
  level: LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label: string) => ({ level: label }) },
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

  return pino(options, stdout);
}

const logger = createLogger();

export { logger };
