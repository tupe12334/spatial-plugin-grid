import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:16066",
    headless: true,
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "pnpm exec vite preview --outDir storybook-static --host 127.0.0.1 --port 16066 --strictPort",
    url: "http://127.0.0.1:16066",
    reuseExistingServer: false,
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
