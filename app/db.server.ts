import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "#prisma/generated/client";

import { logger } from "./logger.server";
import { singleton } from "./utils/singleton.server";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL,
});
// Hard-code a unique key, so we can look up the client when this module gets re-imported
const prisma = singleton("prisma", () => {
  const client = new PrismaClient({
    adapter,
    log: [
      { emit: "event", level: "warn" },
      { emit: "event", level: "error" },
    ],
  });

  client.$on("warn", ({ message, target }) =>
    logger.warn({ target, reason: message }, "Prisma reported a warning"),
  );
  client.$on("error", ({ message, target }) =>
    logger.error({ target, reason: message }, "Prisma reported an error"),
  );

  logger.info(
    { databaseUrl: process.env.DATABASE_URL },
    "database client created",
  );

  client
    .$connect()
    .catch((error: unknown) =>
      logger.error({ error }, "initial database connection failed"),
    );

  return client;
});

export { prisma };
