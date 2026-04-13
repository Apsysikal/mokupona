import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "#prisma/generated/client";

import { singleton } from "./utils/singleton.server";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL,
});
// Hard-code a unique key, so we can look up the client when this module gets re-imported
const prisma = singleton("prisma", () => {
  const client = new PrismaClient({ adapter });
  client.$connect();
  return client;
});

export * from "#prisma/generated/client";
export { prisma };
