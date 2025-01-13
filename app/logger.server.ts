import winston from "winston";

const PRODUCTION = process.env.NODE_ENV === "production";

const logger = winston.createLogger({
  level: PRODUCTION ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: PRODUCTION
    ? [
        new winston.transports.File({
          filename: "./logs/error.log",
          level: "error",
        }),
        new winston.transports.File({ filename: "./logs/combined.log" }),
        new winston.transports.Console({ format: winston.format.simple() }),
      ]
    : [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize({ all: true }),
            winston.format.simple(),
          ),
        }),
      ],
});

export { logger };
