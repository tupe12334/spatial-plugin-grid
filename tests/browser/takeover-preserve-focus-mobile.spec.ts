import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 700 },
  isMobile: true,
  hasTouch: true,
});

test("preserve-mode takeover keeps composer focus and does not pan the mobile viewport on open", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=layouttakeover--systems-picker-preserve-focus&viewMode=story",
  );
  const draft = page.getByRole("textbox", { name: "Draft" });
  await draft.fill("Still typing");
  await draft.focus();
  await expect(draft).toBeFocused();
  const scrollBefore = await page.evaluate(() => ({
    pageTop: window.visualViewport?.pageTop ?? window.scrollY,
    scrollY: window.scrollY,
  }));

  await page
    .getByRole("button", { name: "Open picker" })
    .evaluate((button: HTMLButtonElement) => button.click());

  await expect(page.getByRole("button", { name: "Billing" })).toBeVisible();
  await expect(draft).toBeFocused();
  const scrollAfter = await page.evaluate(() => ({
    pageTop: window.visualViewport?.pageTop ?? window.scrollY,
    scrollY: window.scrollY,
  }));
  expect(scrollAfter).toEqual(scrollBefore);
  await expect(draft).toHaveValue("Still typing");
});
