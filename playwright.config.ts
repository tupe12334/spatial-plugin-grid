import { defineConfig } from "@playwright/test";
const port = Number(process.env.SPG_TEST_PORT || 16166);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid SPG_TEST_PORT");
export default defineConfig({
  workers: 1,
  testDir: "tests/browser",
  fullyParallel: true,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "dark",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm exec vite preview --outDir storybook-static --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
