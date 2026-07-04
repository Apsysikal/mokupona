import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

// Provisions the throwaway SQLite database that DB-backed unit tests run
// against. vitest.config.ts points DATABASE_URL at this file for all test
// workers; recreating it from the real migrations on every run keeps tests
// isolated from dev data and verifies the migration chain on an empty DB.
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
