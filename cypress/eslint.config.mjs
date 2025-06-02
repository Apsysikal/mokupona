import pluginCypress from 'eslint-plugin-cypress';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    plugins: {
      cypress: pluginCypress,
    },
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: "./tsconfig.json"
      }
    }
  }
]
