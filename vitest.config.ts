// @ts-nocheck (https://github.com/sveltejs/kit/issues/13102)

/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./test/setup-test-env.ts"],
    // DB-backed model tests run against a throwaway SQLite file that
    // setup-db.ts recreates from the migrations on every run (dotenv does not
    // override an already-set DATABASE_URL, so this wins over .env).
    globalSetup: ["./test/setup-db.ts"],
    env: {
      DATABASE_URL: "file:./prisma/test.db",
    },
    // SQLite allows one writer: parallel workers sharing test.db abort
    // read-then-write transactions with SQLITE_BUSY. The suite is small, so
    // run files sequentially instead of partitioning databases per worker.
    fileParallelism: false,
  },
});
