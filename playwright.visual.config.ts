import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
import { existsSync } from "node:fs";
if (
  process.platform !== "linux" ||
  process.arch !== "x64" ||
  !existsSync("/.dockerenv") ||
  process.env.SPG_CANONICAL_VISUAL !== "1"
)
  throw new Error(
    "Screenshots require the canonical Docker runner: pnpm test:visual (or test:visual:update).",
  );
export default defineConfig({
  ...base,
  testDir: "tests/visual",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  updateSnapshots: process.env.SPG_UPDATE_BASELINES === "1" ? "all" : "none",
  snapshotPathTemplate: "{testDir}/baselines/{arg}{ext}",
  outputDir: "test-results/visual",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/visual", open: "never" }],
  ],
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      // Native/emulated amd64 RGB rounding: measured YIQ max 0.0027740013094393837.
      // Per-pixel color tolerance only; no differing-pixel allowance (docs/validation.md).
      threshold: 0.003,
      maxDiffPixels: 0,
    },
  },
  use: {
    ...base.use,
    browserName: "chromium",
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "dark",
    reducedMotion: "no-preference",
    launchOptions: {
      args: [
        "--font-render-hinting=none",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-skia-runtime-opts",
        "--disable-partial-raster",
        "--num-raster-threads=1",
      ],
    },
  },
});
