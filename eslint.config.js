import recommendedIncremental from "eslint-config-agent/recommended-incremental";

export default [
  ...recommendedIncremental,
  {
    ignores: [
      "dist/**",
      "storybook-static/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  {
    files: ["**/*.mjs"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
];
