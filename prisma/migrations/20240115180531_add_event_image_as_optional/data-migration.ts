import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "#prisma/generated/client";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL,
  }),
});

async function main() {
  const defaultImage = await readFile(path.join(__dirname, "default.jpg"));
  await prisma.$transaction(async (tx) => {
    const events = await tx.event.findMany();
    for (const event of events) {
      await tx.event.update({
        where: { id: event.id },
        data: {
          image: {
            create: {
              contentType: "image/jpg",
              blob: Buffer.from(defaultImage.buffer),
            },
          },
        },
      });
    }
  });
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
