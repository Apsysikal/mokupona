// @ts-nocheck (https://github.com/sveltejs/kit/issues/13102)

/// <reference types="vitest" />
/// <reference types="vite/client" />

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./test/setup-test-env.ts"],
  },
});
