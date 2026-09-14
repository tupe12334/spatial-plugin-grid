import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { states, verifyInventory } from "./registry";
import {
  geometry,
  pluginHomes,
  type PluginHome,
  type PluginSize,
} from "../../src/layout";
const index = JSON.parse(readFileSync("storybook-static/index.json", "utf8"));
verifyInventory(
  Object.values(index.entries)
    .filter((entry) => (entry as { type: string }).type === "story")
    .map((entry) => (entry as { id: string }).id),
);
if (process.env.SPG_UPDATE_BASELINES !== "1") {
  const expected = states.map(({ name }) => `${name}.png`).sort();
  const actual = readdirSync("tests/visual/baselines")
    .filter((name) => name.endsWith(".png"))
    .sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual))
    throw new Error(
      "Missing or extra PNG baselines; use explicit update and review/commit.",
    );
}
for (const state of states)
  test(state.name, async ({ page }) => {
    if (["workspace--narrow", "workspace--rtl"].includes(state.story))
      await page.setViewportSize({ width: 390, height: 844 });
    if (state.story === "workspace--reduced-motion")
      await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/iframe.html?id=${state.story}&viewMode=story`);
    await expect(
      page.locator("#storybook-root .spg-stage-content"),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    // Snapshot-only stabilization. Functional motion tests use their separate config unchanged.
    await page.addStyleTag({
      content:
        "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }",
    });
    if (state.action.includes("/")) {
      const [home, size] = state.action.split("/") as [PluginHome, PluginSize];
      const tile = page.locator(`[data-home="${home}"]`);
      const initial = (await page.locator('[data-home="11"]').boundingBox())!;
      await tile.locator("select").selectOption(size);
      const rect = geometry(home, size);
      const actual = (await tile.boundingBox())!;
      expect(
        Math.abs(actual.x - (12 + (rect.column - 1) * (initial.width + 12))),
      ).toBeLessThan(1.5);
      expect(
        Math.abs(actual.y - (76 + (rect.row - 1) * (initial.height + 12))),
      ).toBeLessThan(1.5);
      expect(
        Math.abs(
          actual.width -
            (rect.columns * initial.width + (rect.columns - 1) * 12),
        ),
      ).toBeLessThan(1.5);
      expect(
        Math.abs(
          actual.height - (rect.rows * initial.height + (rect.rows - 1) * 12),
        ),
      ).toBeLessThan(1.5);
      await expect(tile).toHaveJSProperty("inert", false);
      for (const other of pluginHomes.filter(
        (candidate) => candidate !== home,
      )) {
        const row = Number(other[0]),
          column = Number(other[1]);
        const covered =
          column >= rect.column &&
          column < rect.column + rect.columns &&
          row >= rect.row &&
          row < rect.row + rect.rows;
        await expect(page.locator(`[data-home="${other}"]`)).toHaveJSProperty(
          "inert",
          covered,
        );
      }
    }
    if (state.action === "expand") {
      await page.locator(".spg-stage-header button").click();
      await expect(page.locator(".spg-stage-header button")).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    }
    if (state.action === "theme")
      await page.getByRole("button", { name: "Change theme" }).click();
    if (state.action === "counter") {
      await page.getByRole("button", { name: /Host count/ }).click();
      await expect(
        page.getByRole("button", { name: /Host count 1/ }),
      ).toBeVisible();
    }
    if (state.action === "append") {
      await page.getByRole("button", { name: "Append message" }).click();
      await expect(page.locator(".spg-message")).toHaveCount(31);
    }
    if (["workspace--narrow", "workspace--rtl"].includes(state.story)) {
      const boxes = await Promise.all(
        ["11", "12", "13", "14"].map((home) =>
          page.locator(`[data-home="${home}"]`).boundingBox(),
        ),
      );
      for (let i = 1; i < 4; i++) {
        expect(boxes[i]!.x).toBeGreaterThan(boxes[i - 1]!.x);
        expect(boxes[i]!.y).toBe(boxes[0]!.y);
      }
    }
    await page.mouse.move(0, 0);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${state.name}.png`);
  });
