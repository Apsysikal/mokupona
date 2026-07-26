// @ts-nocheck (https://github.com/sveltejs/kit/issues/13102)

/// <reference types="vitest" />
/// <reference types="vite/client" />

import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: "happy-dom",
    // Agent worktrees are full checkouts of this repo living under the project
    // root. Without this they contribute a second (stale) copy of every test
    // file, and because all copies share the one test.db their fixtures
    // cross-contaminate the real suite's assertions.
    exclude: [...configDefaults.exclude, "**/.claude/worktrees/**"],
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
