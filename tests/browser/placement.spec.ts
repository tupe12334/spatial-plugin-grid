import { expect, test, type Page } from "@playwright/test";
const rect = async (page: Page, selector: string) => {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`Missing ${selector}`);
  return box;
};
const close = (a: number, b: number) =>
  expect(Math.abs(a - b)).toBeLessThan(1.5);
for (const row of [2, 3])
  for (const column of [1, 2, 3])
    test(`agent at ${row}${column}: every footprint, cover, restoration and bottom anchor`, async ({
      page,
    }) => {
      await page.goto(
        `/iframe.html?id=agentplugin--at-${row}${column}&viewMode=story`,
      );
      const agent = page.locator('[data-plugin-id="assistant"]'),
        upper = page.locator('[data-plugin-id="upper"]');
      await expect(agent).toBeVisible();
      const viewport = page.viewportSize()!;
      const cellWidth = (viewport.width - 24 - 36) / 4,
        cellHeight = (viewport.height - 64 - 24 - 24) / 3;
      const base = await rect(page, '[data-plugin-id="assistant"]'),
        neighbor = await rect(page, '[data-plugin-id="upper"]');
      close(base.x, 12 + (column - 1) * (cellWidth + 12));
      close(base.y, 76 + (row - 1) * (cellHeight + 12));
      close(base.width, cellWidth * 2 + 12);
      close(base.height, cellHeight);
      await page.getByText("Upper count 0").click();
      const bottom = base.y + base.height,
        composer = await rect(page, ".spg-composer");
      await page.getByRole("button", { name: /Expand/ }).click();
      await expect(agent).toHaveAttribute("data-state", "expanded");
      await expect(upper).toHaveJSProperty("inert", true);
      await page.waitForTimeout(550);
      const expanded = await rect(page, '[data-plugin-id="assistant"]');
      close(expanded.y, 76 + (row - 2) * (cellHeight + 12));
      close(expanded.height, cellHeight * 2 + 12);
      close(expanded.y + expanded.height, bottom);
      close((await rect(page, ".spg-composer")).y, composer.y);
      expect(await rect(page, '[data-plugin-id="upper"]')).toEqual(neighbor);
      await page.getByRole("button", { name: /Collapse/ }).click();
      await expect(upper).toHaveJSProperty("inert", false);
      expect(await rect(page, '[data-plugin-id="assistant"]')).toEqual(base);
      expect(await rect(page, '[data-plugin-id="upper"]')).toEqual(neighbor);
      await expect(page.getByText("Upper count 1")).toBeVisible();
    });
test("generic grid is empty and all twelve cells can be occupied", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=pluginplacement--empty&viewMode=story");
  await expect(page.locator(".spg-grid")).toBeVisible();
  await expect(page.locator("[data-spg-panel]")).toHaveCount(0);
  await expect(page.getByRole("log")).toHaveCount(0);
  await page.goto("/iframe.html?id=pluginplacement--all-cells&viewMode=story");
  await expect(page.locator("[data-spg-panel]")).toHaveCount(12);
  await expect(page.locator('[data-home="32"]')).toBeVisible();
  await expect(page.locator('[data-home="33"]')).toBeVisible();
});
test("non-agent chart and inspector expand in different directions and share pinning", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(
    "/iframe.html?id=pluginplacement--non-agent-plugins&viewMode=story",
  );
  const chart = page.locator('[data-plugin-id="chart"]'),
    inspector = page.locator('[data-plugin-id="inspector"]');
  await expect(chart).toBeVisible();
  const base = await rect(page, '[data-plugin-id="chart"]'),
    inspectorBase = await rect(page, '[data-plugin-id="inspector"]');
  await page.getByText("Open chart", { exact: true }).click();
  const full = await rect(page, '[data-plugin-id="chart"]');
  close(full.x, base.x);
  close(full.y, base.y);
  close(full.width, base.width * 3 + 24);
  close(full.height, base.height * 2 + 12);
  await page.getByText("Inspect", { exact: true }).click();
  const detail = await rect(page, '[data-plugin-id="inspector"]');
  close(detail.y + detail.height, inspectorBase.y + inspectorBase.height);
  close(detail.height, inspectorBase.height * 2 + 12);
  await expect(chart).toHaveJSProperty("inert", true);
  await page.getByText("Pin inspector", { exact: true }).click();
  await page.getByText("Reset inspector", { exact: true }).click();
  await expect(inspector).toHaveAttribute("data-state", "detail");
  await page.getByText("Unpin inspector", { exact: true }).click();
  await page.getByText("Reset inspector", { exact: true }).click();
  await expect(chart).toHaveJSProperty("inert", false);
  await page.getByText("Reset chart", { exact: true }).click();
  await expect(chart).toHaveAttribute("data-state", "summary");
  await expect(page.getByRole("log")).toHaveCount(0);
});
