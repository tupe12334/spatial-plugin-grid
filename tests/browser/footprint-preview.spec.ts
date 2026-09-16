import { expect, test, type Locator, type Page } from "@playwright/test";
const closeTo = async (
  preview: Locator,
  expected: { x: number; y: number; width: number; height: number },
) => {
  await expect
    .poll(async () => {
      const actual = await preview.boundingBox();
      return actual
        ? Math.max(
            ...Object.keys(expected).map((key) =>
              Math.abs(
                actual[key as keyof typeof expected] -
                  expected[key as keyof typeof expected],
              ),
            ),
          )
        : Infinity;
    })
    .toBeLessThan(1.5);
};
const geometry = (page: Page, expanded: boolean) =>
  page.locator(".spg-grid").evaluate((element, large) => {
    const grid = element.getBoundingClientRect(),
      css = getComputedStyle(element),
      padding = parseFloat(css.paddingLeft),
      gap = parseFloat(css.gap);
    const width = (grid.width - 2 * padding - 3 * gap) / 4;
    const height = (grid.height - 2 * padding - 2 * gap) / 3;
    return {
      target: {
        x: grid.x + padding + 2 * (width + gap) + width / 2,
        y: grid.y + padding + height + gap + height / 2,
      },
      footprint: {
        x: grid.x + padding + width + gap,
        y: grid.y + padding + (large ? 0 : height + gap),
        width: 2 * width + gap,
        height: large ? 2 * height + gap : height,
      },
    };
  }, expanded);
for (const expanded of [false, true]) {
  for (const rtl of [false, true]) {
    for (const mode of ["pointer", "keyboard"] as const) {
      test(`${mode} highlights entire ${expanded ? "2x2" : "1x2"} bottom-right footprint in ${rtl ? "RTL" : "LTR"}`, async ({
        page,
      }) => {
        await page.goto(
          `/iframe.html?id=pluginplacement--drag-and-drop${rtl ? "-rtl" : ""}&viewMode=story`,
        );
        const handle = page.getByRole("button", {
          name: "Move Inspector",
          exact: true,
        });
        await expect(handle).toBeEnabled();
        if (expanded) {
          await page
            .getByRole("button", { name: "Inspect", exact: true })
            .click();
          await expect(handle).toBeEnabled();
        }
        const bounds = await geometry(page, expanded);
        if (mode === "pointer") {
          await handle.hover();
          await page.mouse.down();
          await page.mouse.move(bounds.target.x, bounds.target.y, { steps: 6 });
        } else {
          await handle.press("Enter");
          for (
            let count = 0;
            count < 12 &&
            (await page
              .locator('[data-drop-hover="true"]')
              .getAttribute("data-drop-target")) !== "23";
            count++
          )
            await handle.press("ArrowRight");
        }
        const preview = page.locator(
          '[data-drop-target="23"][data-drop-hover="true"]',
        );
        await expect(preview).toBeVisible();
        await closeTo(preview, bounds.footprint);
        if (mode === "pointer") {
          await page.mouse.up();
          await closeTo(
            page.locator('[data-plugin-id="inspector"]'),
            bounds.footprint,
          );
          await expect(page.locator("[data-drop-target]")).toHaveCount(0);
        } else {
          await handle.press("Escape");
          await expect(page.locator("[data-drop-target]")).toHaveCount(0);
          await expect(
            page.locator('[data-plugin-id="inspector"]'),
          ).toHaveAttribute("data-home", "34");
        }
      });
    }
  }
}
