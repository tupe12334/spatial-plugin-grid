import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { states, verifyInventory, verifyBaselines } from "./registry";
import {
  geometry,
  pluginHomes,
  type PluginHome,
  type PluginSize,
} from "../../src/presets/groupedLayout";
const index = JSON.parse(readFileSync("storybook-static/index.json", "utf8"));
verifyInventory(
  Object.values(index.entries)
    .filter((entry) => (entry as { type: string }).type === "story")
    .map((entry) => (entry as { id: string }).id),
);
if (process.env.SPG_UPDATE_BASELINES !== "1")
  verifyBaselines(readdirSync("tests/visual/baselines"));
for (const state of states)
  test(state.name, async ({ page }) => {
    if (["workspace--narrow", "workspace--rtl"].includes(state.story))
      await page.setViewportSize({ width: 390, height: 844 });
    if (state.story === "workspace--reduced-motion")
      await page.emulateMedia({ reducedMotion: "reduce" });
    // Load the real Storybook font faces before its entry module can mount React.
    // Waiting after mount can leave first-layout scroll measurements stale.
    await page.route("**/iframe.html?*", async (route) => {
      const response = await route.fetch();
      const html = await response.text();
      const entry =
        /<script type="module" crossorigin src="([^"]+)"><\/script>/;
      if (!entry.test(html))
        throw new Error("Storybook module entry not found");
      await route.fulfill({
        response,
        body: html.replace(
          entry,
          (_, src: string) => `<script type="module">
          await Promise.all([...document.fonts].map(face => face.load()));
          await document.fonts.ready;
          await import(${JSON.stringify(src)});
        </script>`,
        ),
      });
    });
    await page.goto(`/iframe.html?id=${state.story}&viewMode=story`);
    await expect(page.locator("#storybook-root .spg-root")).toBeVisible({
      timeout: 60_000,
    });
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
    if (state.action.startsWith("drag-")) {
      const handle = page.getByRole("button", {
        name: "Move Inspector",
        exact: true,
      });
      if (state.action.endsWith("expanded"))
        await page
          .getByRole("button", { name: "Inspect", exact: true })
          .click();
      await expect(handle).toBeEnabled();
      await handle.press("Enter");
      const target = state.action.includes("overlap") ? "33" : "23";
      for (
        let count = 0;
        count < 12 &&
        (await page
          .locator('[data-drop-hover="true"]')
          .getAttribute("data-drop-target")) !== target;
        count++
      )
        await handle.press("ArrowRight");
      await expect(
        page.locator(`[data-drop-target="${target}"]`),
      ).toHaveAttribute("data-drop-hover", "true");
    }
    if (state.action === "chart")
      await page.getByText("Open chart", { exact: true }).click();
    if (state.action === "inspector")
      await page.getByText("Inspect", { exact: true }).click();
    if (state.action === "expand") {
      await page.locator(".spg-stage-header button[aria-expanded]").click();
      await expect(
        page.locator(".spg-stage-header button[aria-expanded]"),
      ).toHaveAttribute("aria-expanded", "true");
    }
    if (state.action === "pin" || state.action === "pin-overlap") {
      await page
        .getByRole("button", { name: "Lock expanded stage", exact: true })
        .click();
      if (state.action === "pin-overlap")
        await page.locator('[data-home="11"] select').selectOption("2x2");
      await expect(page.locator(".spg-stage")).toHaveJSProperty("inert", false);
      await expect(page.locator('[data-home="22"]')).toHaveJSProperty(
        "inert",
        true,
      );
      await expect(page.locator('[data-home="23"]')).toHaveJSProperty(
        "inert",
        true,
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
    // ResizeObserver, React effects and scroll events must all finish before capture.
    // Observe real geometry/styles; do not rewrite transcript transforms or scroll.
    await page.evaluate(async () => {
      let previous = "",
        stable = 0;
      for (let frame = 0; frame < 120; frame++) {
        await new Promise(requestAnimationFrame);
        const signature = JSON.stringify(
          [
            ...document.querySelectorAll<HTMLElement>(
              ".spg-history, .spg-message, .spg-composer",
            ),
          ].map((element) => ({
            rect: element.getBoundingClientRect().toJSON(),
            scroll: [
              element.scrollTop,
              element.scrollHeight,
              element.clientHeight,
            ],
            transform: getComputedStyle(element).transform,
            opacity: getComputedStyle(element).opacity,
          })),
        );
        stable = signature === previous ? stable + 1 : 0;
        if (stable >= 5) return;
        previous = signature;
      }
      throw new Error("Transcript layout/scroll did not settle");
    });
    await expect(page).toHaveScreenshot(`${state.name}.png`);
  });
