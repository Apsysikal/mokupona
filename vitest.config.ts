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
    exclude: [...configDefaults.exclude, "**/.claude/worktrees/**"],
    setupFiles: ["./test/setup-test-env.ts"],
    globalSetup: ["./test/setup-db.ts"],
    env: {
      DATABASE_URL: "file:./prisma/test.db",
    },
    fileParallelism: false,
  },
});
