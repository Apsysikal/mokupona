import { PrismaClient } from "@prisma/client/index.js";

import { singleton } from "./utils/singleton.server";

// Hard-code a unique key, so we can look up the client when this module gets re-imported
const prisma = singleton("prisma", () => new PrismaClient());
prisma.$connect();

export * from "@prisma/client/index.js";
export { prisma };
