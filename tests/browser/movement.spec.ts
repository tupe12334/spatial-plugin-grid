import { expect, test, type Page } from "@playwright/test";
const open = async (page: Page, rtl = false) => {
  await page.goto(
    `/iframe.html?id=pluginplacement--drag-and-drop${rtl ? "-rtl" : ""}&viewMode=story`,
  );
  await expect(page.getByRole("button", { name: "Move Status" })).toBeVisible();
};
const cell = (page: Page, row: number, column: number) =>
  page.locator(".spg-grid").evaluate(
    (grid, target) => {
      const rect = grid.getBoundingClientRect(),
        css = getComputedStyle(grid),
        padding = parseFloat(css.paddingLeft),
        gap = parseFloat(css.gap);
      const width = (rect.width - 2 * padding - 3 * gap) / 4;
      const height = (rect.height - 2 * padding - 2 * gap) / 3;
      return {
        x:
          rect.left + padding + (target.column - 1) * (width + gap) + width / 2,
        y: rect.top + padding + (target.row - 1) * (height + gap) + height / 2,
      };
    },
    { row, column },
  );
const drag = async (page: Page, name: string, row: number, column: number) => {
  const box = await page
    .getByRole("button", { name: `Move ${name}`, exact: true })
    .boundingBox();
  if (!box) throw new Error("Missing move handle");
  const target = await cell(page, row, column);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 6 });
  await page.mouse.up();
};
const panel = (page: Page, id: string) =>
  page.locator(`[data-plugin-id="${id}"]`);
test("mouse moves into empty cells and preserves stateful content", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Count 0", exact: true }).click();
  await drag(page, "Status", 2, 4);
  await expect(panel(page, "status")).toHaveAttribute("data-home", "24");
  await expect(
    page.getByRole("button", { name: "Count 1", exact: true }),
  ).toBeVisible();
});
test("atomic compatible swap moves both blocks, but incompatible reverse leg is rejected", async ({
  page,
}) => {
  await open(page);
  await drag(page, "Status", 1, 1); // Chart cannot relocate to 14: its detail width is three.
  await expect(panel(page, "status")).toHaveAttribute("data-home", "14");
  await drag(page, "Status", 1, 2);
  await drag(page, "Chart", 1, 2);
  await expect(panel(page, "chart")).toHaveAttribute("data-home", "12");
  await expect(panel(page, "status")).toHaveAttribute("data-home", "11");
});
test("main-stage appearance follows all-state geometry: rejects row one and permits compatible row two", async ({
  page,
}) => {
  await open(page);
  for (const column of [1, 2, 3, 4]) {
    await drag(page, "Inspector", 1, column);
    await expect(panel(page, "inspector")).toHaveAttribute("data-home", "34");
  }
  await drag(page, "Inspector", 2, 3);
  await expect(panel(page, "inspector")).toHaveAttribute("data-home", "23");
});
test("keyboard movement and Escape cancellation", async ({ page }) => {
  await open(page);
  const handle = page.getByRole("button", { name: "Move Status", exact: true });
  await handle.press("Enter");
  await handle.press("ArrowRight");
  await expect(page.getByRole("status")).toContainText("Target");
  await handle.press("Escape");
  await expect(panel(page, "status")).toHaveAttribute("data-home", "14");
  await handle.press("Enter");
  await handle.press("Enter");
  await expect(panel(page, "status")).toHaveAttribute("data-home", "12");
});
test("touch uses real browser pointer events", async ({ page, context }) => {
  await open(page);
  const box = await page
    .getByRole("button", { name: "Move Status", exact: true })
    .boundingBox();
  if (!box) throw new Error("Missing handle");
  const target = await cell(page, 2, 4),
    session = await context.newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [target],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
  await expect(panel(page, "status")).toHaveAttribute("data-home", "24");
});
test("pinned expanded block cannot move and covers empty destinations", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Inspect", exact: true }).click();
  await page
    .getByRole("button", { name: "Pin inspector", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Move Inspector", exact: true }),
  ).toBeDisabled();
  await drag(page, "Status", 2, 4);
  await expect(panel(page, "status")).toHaveAttribute("data-home", "14");
});
test("physical coordinates stay stable in RTL", async ({ page }) => {
  await open(page, true);
  await drag(page, "Status", 2, 1);
  await expect(panel(page, "status")).toHaveAttribute("data-home", "21");
});
test("pointer Escape cancels and right-button input does not begin a move", async ({
  page,
}) => {
  await open(page);
  const handle = page.getByRole("button", { name: "Move Status", exact: true });
  await handle.click({ button: "right" });
  await expect(page.locator("[data-drop-target]")).toHaveCount(0);
  await handle.hover();
  await page.mouse.down();
  const target = await cell(page, 2, 4);
  await page.mouse.move(target.x, target.y);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(panel(page, "status")).toHaveAttribute("data-home", "14");
});
