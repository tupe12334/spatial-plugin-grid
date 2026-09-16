import { expect, test, type Locator, type Page } from "@playwright/test";
const expectNoSeams = async (page: Page) => {
  const overlaps = await page.locator(".spg-grid").evaluate((grid) => {
    const active = grid.querySelector('[data-drop-hover="true"]');
    if (!active) throw new Error("Missing active footprint");
    const selected = active.getBoundingClientRect();
    return Array.from(
      grid.querySelectorAll('[data-drop-hover="false"]'),
    ).filter((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return (
        rect.left < selected.right &&
        rect.right > selected.left &&
        rect.top < selected.bottom &&
        rect.bottom > selected.top
      );
    }).length;
  });
  expect(overlaps).toBe(0);
};
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
const geometry = (page: Page, expanded: boolean, rtl: boolean) =>
  page.locator(".spg-grid").evaluate(
    (element, { large, rtl }) => {
      const grid = element.getBoundingClientRect(),
        css = getComputedStyle(element),
        padding = parseFloat(css.paddingLeft),
        gap = parseFloat(css.gap);
      const width = (grid.width - 2 * padding - 3 * gap) / 4;
      const height = (grid.height - 2 * padding - 2 * gap) / 3;
      return {
        target: {
          x: grid.x + padding + (rtl ? 2 : 1) * (width + gap) + width / 2,
          y: grid.y + padding + (large ? 0 : height + gap) + height / 2,
        },
        footprint: {
          x: grid.x + padding + width + gap,
          y: grid.y + padding + (large ? 0 : height + gap),
          width: 2 * width + gap,
          height: large ? 2 * height + gap : height,
        },
      };
    },
    { large: expanded, rtl },
  );
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
        const bounds = await geometry(page, expanded, rtl);
        let allTargets: string[] = [];
        if (mode === "pointer") {
          await handle.hover();
          await page.mouse.down();
          allTargets = await page
            .locator("[data-drop-target]")
            .evaluateAll((elements) =>
              elements.map(
                (element) => element.getAttribute("data-drop-target") ?? "",
              ),
            );
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
        await expectNoSeams(page);
        if (mode === "pointer") {
          // Outside the grid is invalid: restore every permitted outline.
          await page.mouse.move(1, 1);
          await expect(page.locator('[data-drop-hover="true"]')).toHaveCount(0);
          expect(
            await page
              .locator("[data-drop-target]")
              .evaluateAll((elements) =>
                elements.map(
                  (element) => element.getAttribute("data-drop-target") ?? "",
                ),
              ),
          ).toEqual(allTargets);
          // A cell inside the grid can also map to a forbidden anchor.
          const invalidX = await page
            .locator(".spg-grid")
            .evaluate((element, rtl) => {
              const rect = element.getBoundingClientRect();
              return rtl ? rect.left + 100 : rect.right - 100;
            }, rtl);
          await page.mouse.move(invalidX, bounds.target.y);
          await expect(page.locator('[data-drop-hover="true"]')).toHaveCount(0);
          await expect(page.locator("[data-drop-target]")).toHaveCount(
            allTargets.length,
          );
          await page.mouse.move(bounds.target.x, bounds.target.y);
          await expectNoSeams(page);
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
for (const expanded of [false, true]) {
  test(`partial source overlap has no movement outline (${expanded ? "expanded" : "compact"})`, async ({
    page,
  }) => {
    await page.goto(
      "/iframe.html?id=pluginplacement--drag-and-drop&viewMode=story",
    );
    const handle = page.getByRole("button", {
      name: "Move Inspector",
      exact: true,
    });
    if (expanded)
      await page.getByRole("button", { name: "Inspect", exact: true }).click();
    await expect(handle).toBeEnabled();
    await handle.press("Enter");
    for (
      let count = 0;
      count < 12 &&
      (await page
        .locator('[data-drop-hover="true"]')
        .getAttribute("data-drop-target")) !== "33";
      count++
    )
      await handle.press("ArrowRight");
    await expect(page.locator('[data-drop-target="33"]')).toHaveAttribute(
      "data-drop-hover",
      "true",
    );
    await expectNoSeams(page);
    const source = page.locator('[data-plugin-id="inspector"]');
    await expect(source).toHaveAttribute("data-drag-source-overlap", "true");
    await expect(source).toHaveCSS("outline-style", "none");
    await expect(source).toHaveCSS("border-left-color", "rgba(0, 0, 0, 0)");
    await expect(source).toHaveCSS("box-shadow", "none");
    if (!expanded)
      await expect(page.locator('[data-drop-hover="false"]')).not.toHaveCount(
        0,
      );
    await page.screenshot({
      path: `test-results/seamless-source-${expanded ? "expanded" : "compact"}.png`,
    });
    await handle.press("Enter");
    await expect(source).toHaveAttribute("data-home", "33");
    await expect(source).toHaveAttribute("data-drag-source-overlap", "false");
    await expect(source).not.toHaveCSS("border-left-color", "rgba(0, 0, 0, 0)");
  });
}
