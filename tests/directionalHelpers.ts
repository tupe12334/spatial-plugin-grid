import type { Locator } from "@playwright/test";
export async function setSize(tile: Locator, size: string) {
  if ((await tile.getAttribute("data-state")) === size) return;
  await tile.locator(`[data-target-state="${size}"]`).click();
}
