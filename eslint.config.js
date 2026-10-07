import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/build/**",
      "**/public/build**",
      "**/.react-router/**",
      "**/prisma/generated/**",
    ],
  },
  {
    plugins: {
      import: (await import("eslint-plugin-import-x")).default,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "import/order": [
        "warn",
        {
          alphabetize: { caseInsensitive: true, order: "asc" },
          groups: ["builtin", "external", "internal", "parent", "sibling"],
          "newlines-between": "always",
        },
      ],
    },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react: (await import("eslint-plugin-react")).default,
    },
    languageOptions: {
      parser: (await import("typescript-eslint")).parser,
      parserOptions: {
        jsx: true,
      },
    },
    rules: {
      "react/jsx-no-leaked-render": ["warn", { validStrategies: ["ternary"] }],
    },
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "react-hooks": (await import("eslint-plugin-react-hooks")).default,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: (await import("typescript-eslint")).parser,
    },
    plugins: {
      "@typescript-eslint": (await import("typescript-eslint")).plugin,
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["**/*.test.{js,jsx,ts,tsx}"],
    plugins: {
      "jest-dom": (await import("eslint-plugin-jest-dom")).default,
    },
    settings: {
      jest: {
        version: 28,
      },
    },
  },
  {
    files: ["cypress/**/*.ts"],
    plugins: {
      cypress: (await import("eslint-plugin-cypress")).default,
    },
  },
  {
    files: ["app/**/*.{js,jsx,ts,tsx}"],
    ignores: [
      "app/models/**",
      "app/db.server.ts",
      "app/features/auth/auth.server.ts",
      "**/*.test.{js,jsx,ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/db.server", "#prisma/generated/*"],
              message:
                "Only app/models/** may import the database layer. Use or add a model function instead.",
            },
          ],
        },
      ],
    },
  },
];
