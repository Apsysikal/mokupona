import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const TEST_DB = "prisma/test.db";

export default function setup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(`${TEST_DB}${suffix}`, { force: true });
  }

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: `file:./${TEST_DB}` },
    stdio: "pipe",
  });
}
