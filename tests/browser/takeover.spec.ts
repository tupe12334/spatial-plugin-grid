import { expect, test } from "@playwright/test";

for (const dir of ["ltr", "rtl"] as const) {
  test(`takeover retains pinned chat and expanded widget with eight actionable cells (${dir})`, async ({
    page,
  }) => {
    await page.goto(
      "/iframe.html?id=layouttakeover--systems-picker&viewMode=story",
    );
    await page
      .locator(".spg-root")
      .evaluate((node, direction) => node.setAttribute("dir", direction), dir);
    await page.getByRole("button", { name: "Close picker" }).click();
    await page
      .getByRole("button", { name: "Expand clock", exact: true })
      .click();
    const clock = page.locator('[data-plugin-id="clock"]');
    const agent = page.locator('[data-plugin-id="agent"]');
    await page.getByRole("button", { name: "Expand ↗", exact: true }).click();
    await page.getByRole("button", { name: /Lock expanded/ }).click();
    const draft = page.getByRole("textbox", { name: "Draft" });
    await draft.fill("Retain my draft");
    await draft.evaluate((node) =>
      node.setAttribute("data-identity", "retained"),
    );
    await clock.evaluate((node) =>
      node.setAttribute("data-identity", "retained"),
    );
    await expect(agent).toHaveAttribute("data-pinned", "true");
    await expect(clock).toHaveAttribute("data-state", "2x2");
    await page.waitForTimeout(550);
    const expandedBounds = await agent.boundingBox();
    const clockBounds = await clock.boundingBox();
    await page.getByRole("button", { name: "Open picker" }).click();
    await expect(agent).toHaveAttribute("data-state", "collapsed");
    await expect(agent).toHaveJSProperty("inert", false);
    await expect(clock).toHaveJSProperty("inert", true);
    const cards = page.locator('[data-plugin-id^="choice-"]');
    await expect(cards).toHaveCount(8);
    for (const card of await cards.all()) {
      await card.getByRole("button").click();
      await expect(card.getByRole("button")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const box = await card.boundingBox();
      const chat = await agent.boundingBox();
      if (!box || !chat) throw new Error("Missing takeover geometry");
      expect(box.y + box.height).toBeLessThanOrEqual(chat.y + 1);
    }
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Page 2")).toHaveCount(8);
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await draft.fill("Still interactive");
    await draft.press("Escape");
    await expect(cards).toHaveCount(0);
    await expect(agent).toHaveAttribute("data-state", "expanded");
    await expect(agent).toHaveAttribute("data-pinned", "true");
    await expect(clock).toHaveAttribute("data-state", "2x2");
    await expect(clock).toHaveAttribute("data-identity", "retained");
    await expect(draft).toHaveAttribute("data-identity", "retained");
    await expect(draft).toHaveValue("Still interactive");
    await expect(
      page.getByRole("button", { name: "Open picker" }),
    ).toBeFocused();
    await page.waitForTimeout(550);
    expect(await agent.boundingBox()).toEqual(expandedBounds);
    expect(await clock.boundingBox()).toEqual(clockBounds);
  });
}
