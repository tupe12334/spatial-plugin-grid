// @vitest-environment node
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// Resolve through the pinned dependency chain, without adding a PNG dependency.
const require = createRequire(import.meta.url);
const playwright = createRequire(require.resolve("@playwright/test"));
const core = createRequire(playwright.resolve("playwright"));
const { PNG } = core("playwright-core/lib/utilsBundle");
const { utils } = core("playwright-core/lib/coreBundle");
const compare = utils.getComparator("image/png");
const source = readFileSync(
  new URL("../playwright.visual.config.ts", import.meta.url),
  "utf8",
);
const options = {
  threshold: Number(source.match(/threshold:\s*([\d.]+)/)?.[1]),
  maxDiffPixels: Number(source.match(/maxDiffPixels:\s*(\d+)/)?.[1]),
};
function png(center: number[]) {
  // Flat neighborhood prevents antialias edge suppression of the changed pixel.
  const image = new PNG({ width: 9, height: 9 });
  for (let offset = 0; offset < image.data.length; offset += 4)
    image.data.set([141, 145, 157, 255], offset);
  image.data.set(center, (4 * 9 + 4) * 4);
  return PNG.sync.write(image);
}

test("configured comparator accepts measured native rounding but rejects one high-contrast pixel", () => {
  expect(options).toEqual({ threshold: 0.003, maxDiffPixels: 0 });
  const expected = png([141, 145, 157, 255]);
  // Worst pair across all 30 CI artifacts: appending-transcript at (650, 232).
  const rounding = png([140, 145, 158, 255]);
  expect(
    compare(rounding, expected, { ...options, threshold: 0 })?.errorMessage,
  ).toContain("1 pixels");
  expect(compare(rounding, expected, options)).toBeNull();
  for (const color of [
    [0, 0, 0, 255],
    [255, 255, 255, 255],
  ])
    expect(compare(png(color), expected, options)?.errorMessage).toContain(
      "1 pixels",
    );
});
