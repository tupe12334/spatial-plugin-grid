import { expect, test, type Page } from "@playwright/test";
import { geometry, pluginHomes, sizesFor } from "../../src/layout";
const open = async (page: Page, story = "reference-workspace") => {
  await page.goto(`/iframe.html?id=workspace--${story}&viewMode=story`);
  await expect(page.locator(".spg-stage")).toBeVisible();
};
const box = async (page: Page, selector: string) => {
  const result = await page.locator(selector).boundingBox();
  if (!result) throw new Error(`Missing ${selector}`);
  return result;
};
const close = (a: number, b: number) =>
  expect(Math.abs(a - b)).toBeLessThan(1.5);
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollHeight <= innerHeight &&
        document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test("default layout and every allowed size: inward overlays, home labels, no reflow or overflow", async ({
  page,
}) => {
  await open(page);
  const baseline = await Promise.all(
    pluginHomes.map((home) => box(page, `[data-home="${home}"]`)),
  );
  const first = baseline[0]!;
  close(first.x, 12);
  close(first.y, 76);
  for (const home of pluginHomes)
    for (const size of sizesFor(home)) {
      await page.locator(`[data-home="${home}"] select`).selectOption(size);
      const rect = geometry(home, size),
        actual = await box(page, `[data-home="${home}"]`);
      close(actual.x, 12 + (rect.column - 1) * (first.width + 12));
      close(actual.y, 76 + (rect.row - 1) * (first.height + 12));
      close(actual.width, rect.columns * first.width + (rect.columns - 1) * 12);
      close(actual.height, rect.rows * first.height + (rect.rows - 1) * 12);
      for (let i = 0; i < pluginHomes.length; i++)
        if (pluginHomes[i] !== home) {
          const other = await box(page, `[data-home="${pluginHomes[i]}"]`);
          expect(other).toEqual(baseline[i]);
        }
      await expect(page.locator(`[data-home="${home}"] .spg-home`)).toHaveText(
        home,
      );
      await noOverflow(page);
      await page.locator(`[data-home="${home}"] select`).selectOption("1x1");
    }
  await page.screenshot({ path: "test-results/reference-workspace.png" });
});
test("main stage has intermediate geometry in BOTH directions and pinned composer", async ({
  page,
}) => {
  await open(page);
  const base = await box(page, ".spg-stage"),
    composer = await box(page, ".spg-composer");
  await page
    .locator(".spg-stage-content")
    .dispatchEvent("wheel", { deltaY: -100 });
  await page.waitForTimeout(80);
  const expanding = await box(page, ".spg-stage");
  expect(expanding.height).toBeGreaterThan(base.height + 10);
  expect(expanding.height).toBeLessThan(base.height * 2 + 11);
  close((await box(page, ".spg-composer")).y, composer.y);
  await page.waitForTimeout(500);
  const expanded = await box(page, ".spg-stage");
  close(expanded.height, base.height * 2 + 12);
  close(expanded.y + expanded.height, base.y + base.height);
  await expect(page.locator('[data-home="22"]')).toHaveJSProperty(
    "inert",
    true,
  );
  await page.screenshot({ path: "test-results/expanded-stage.png" });
  await page
    .locator(".spg-stage-content")
    .dispatchEvent("wheel", { deltaY: 100 });
  await page.waitForTimeout(80);
  const collapsing = await box(page, ".spg-stage");
  expect(collapsing.height).toBeGreaterThan(base.height + 1);
  expect(collapsing.height).toBeLessThan(expanded.height - 10);
  close((await box(page, ".spg-composer")).y, composer.y);
  await page.waitForTimeout(500);
  close((await box(page, ".spg-stage")).height, base.height);
  await expect(page.locator('[data-home="22"]')).toHaveJSProperty(
    "inert",
    false,
  );
  await noOverflow(page);
});
test("nonoverflowing transcript keyboard, Escape, touch and reduced-motion geometry", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const base = await box(page, ".spg-stage"),
    history = page.getByRole("log");
  for (const key of ["ArrowUp", "PageUp", "Home"]) {
    await history.focus();
    await history.press(key);
    close((await box(page, ".spg-stage")).height, base.height * 2 + 12);
    await history.press("Escape");
    close((await box(page, ".spg-stage")).height, base.height);
  }
  for (const key of ["ArrowDown", "PageDown", "End"]) {
    await page.getByRole("button", { name: /Expand/ }).click();
    await history.focus();
    await history.press(key);
    close((await box(page, ".spg-stage")).height, base.height);
  }
  await history.dispatchEvent("touchstart", {
    touches: [{ identifier: 1, clientY: 300 }],
  });
  await history.dispatchEvent("touchmove", {
    touches: [{ identifier: 1, clientY: 350 }],
  });
  close((await box(page, ".spg-stage")).height, base.height * 2 + 12);
  await history.dispatchEvent("touchmove", {
    touches: [{ identifier: 1, clientY: 200 }],
  });
  close((await box(page, ".spg-stage")).height, base.height);
  expect(
    await page
      .locator(".spg-message")
      .first()
      .evaluate((element) => getComputedStyle(element).transform),
  ).toBe("none");
  expect(
    await page
      .locator(".spg-stage")
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
});
test("latest expansion fronts prior panels and recovers focus", async ({
  page,
}) => {
  await open(page);
  await page.locator('[data-home="11"] select').selectOption("2x2");
  await page.locator('[data-home="31"] select').selectOption("1x2");
  await expect(page.locator('[data-home="11"]')).toHaveJSProperty(
    "inert",
    true,
  );
  await page.locator('[data-home="31"] select').press("Escape");
  await expect(page.locator('[data-home="11"]')).toHaveJSProperty(
    "inert",
    false,
  );
  await page.locator('[data-home="11"] select').selectOption("1x1");
  await expect(page.locator('[data-home="22"]')).toHaveJSProperty(
    "inert",
    false,
  );
});
test("theme changes live and narrow/RTL geometry remains fixed", async ({
  page,
}) => {
  await open(page, "theme-updates");
  const color = await page
    .locator(".spg-root")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.getByRole("button", { name: "Change theme" }).click();
  expect(
    await page
      .locator(".spg-root")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe(color);
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  await open(page, "rtl");
  expect((await box(page, '[data-home="11"]')).x).toBeLessThan(
    (await box(page, '[data-home="14"]')).x,
  );
  await noOverflow(page);
  await page.screenshot({ path: "test-results/narrow-rtl.png" });
});
test("unmount disconnects all ResizeObservers and remount works", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = window.ResizeObserver;
    let active = 0;
    Object.defineProperty(window, "spgObservers", { get: () => active });
    window.ResizeObserver = class extends Original {
      private counted = false;
      override observe(target: Element, options?: ResizeObserverOptions) {
        if (!this.counted) {
          active++;
          this.counted = true;
        }
        super.observe(target, options);
      }
      override disconnect() {
        if (this.counted) {
          active--;
          this.counted = false;
        }
        super.disconnect();
      }
    };
  });
  await open(page, "cleanup");
  const count = () =>
    page.evaluate(() => Reflect.get(window, "spgObservers") as number);
  const mounted = await count();
  await page.getByRole("button", { name: "Toggle mount" }).click();
  expect(await count()).toBeLessThan(mounted);
  await page.getByRole("button", { name: "Toggle mount" }).click();
  await expect(page.locator(".spg-stage")).toBeVisible();
  expect(await count()).toBe(mounted);
});

test("native wheel and toggle keyboard activation; covered controls leave tab order", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await page.locator('[data-home="22"] select').focus();
  await page.locator('[data-home="11"] select').selectOption("2x2");
  await expect(page.locator('[data-home="11"] select')).toBeFocused();
  await page
    .locator('[data-home="22"] select')
    .evaluate((element) => element.focus());
  await expect(page.locator('[data-home="11"] select')).toBeFocused();
  for (let step = 0; step < 16; step++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => document.activeElement?.closest("[inert]") === null,
      ),
    ).toBe(true);
  }
  await page.locator('[data-home="11"] select').selectOption("1x1");
  await page.locator('[data-home="22"] select').focus();
  await expect(page.locator('[data-home="22"] select')).toBeFocused();
  const toggle = page.locator(".spg-stage-header button");
  await toggle.focus();
  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.locator(".spg-history").hover();
  await page.mouse.wheel(0, -100);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.mouse.wheel(0, 100);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("transcript starts latest, follows near-bottom appends and preserves older reading", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=mainstage--appending-transcript&viewMode=story",
  );
  const history = page.getByRole("log");
  const gap = () =>
    history.evaluate(
      (element) =>
        element.scrollHeight - element.clientHeight - element.scrollTop,
    );
  await expect(history).toBeVisible();
  expect(
    await history.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await expect.poll(gap).toBeLessThanOrEqual(1);
  await history.evaluate((element) => {
    element.scrollTop -= 30;
    element.dispatchEvent(new Event("scroll"));
  });
  await page.getByRole("button", { name: "Append message" }).click();
  await expect(history.locator(".spg-message")).toHaveCount(31);
  await expect.poll(gap).toBeLessThanOrEqual(1);
  await history.evaluate((element) => {
    element.scrollTop = 100;
    element.dispatchEvent(new Event("scroll"));
  });
  await page.getByRole("button", { name: "Rerender", exact: true }).click();
  await expect(history).toHaveJSProperty("scrollTop", 100);
  await page.getByRole("button", { name: "Append message" }).click();
  await expect(history.locator(".spg-message")).toHaveCount(32);
  await expect(history).toHaveJSProperty("scrollTop", 100);
});

for (const input of ["wheel", "Home", "Shift+Space"] as const) {
  test(`first native ${input} leaves latest messages during expansion`, async ({
    page,
  }) => {
    await page.goto(
      "/iframe.html?id=mainstage--resizing-transcript&viewMode=story",
    );
    const history = page.getByRole("log");
    const gap = () =>
      history.evaluate(
        (element) =>
          element.scrollHeight - element.clientHeight - element.scrollTop,
      );
    await expect(history).toBeVisible();
    await expect.poll(gap).toBeLessThanOrEqual(1);
    if (input === "wheel") {
      await history.hover();
      await page.mouse.wheel(0, -150);
    } else {
      await history.focus();
      await history.press(input);
    }
    await expect(page.locator(".spg-stage-header button")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await page.waitForTimeout(650);
    expect(await gap()).toBeGreaterThan(48);
    if (input === "Home")
      await expect(history).toHaveJSProperty("scrollTop", 0);
    const top = await history.evaluate((element) => element.scrollTop);
    await page.getByRole("button", { name: "Append message" }).click();
    await expect(history.locator(".spg-message")).toHaveCount(31);
    await expect(history).toHaveJSProperty("scrollTop", top);
  });
}

test("native Space returns from Home to bottom and resumes append following", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=mainstage--resizing-transcript&viewMode=story",
  );
  const history = page.getByRole("log");
  const gap = () =>
    history.evaluate(
      (element) =>
        element.scrollHeight - element.clientHeight - element.scrollTop,
    );
  await expect(history).toBeVisible();
  await expect.poll(gap).toBeLessThanOrEqual(1);
  await history.focus();
  await history.press("Home");
  await expect(history).toHaveJSProperty("scrollTop", 0);
  await page.waitForTimeout(650);
  for (let presses = 0; presses < 30 && (await gap()) > 1; presses++) {
    const top = await history.evaluate((element) => element.scrollTop);
    await history.press("Space");
    await expect.poll(() => history.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(top);
    await page.waitForTimeout(650);
  }
  await expect.poll(gap).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Append message" }).click();
  await expect(history.locator(".spg-message")).toHaveCount(31);
  await expect.poll(gap).toBeLessThanOrEqual(1);
});

for (const following of [true, false]) {
  test(`integrated stage resize preserves ${following ? "latest bottom" : "older reading"} throughout expand/collapse`, async ({
    page,
  }) => {
    await page.goto(
      "/iframe.html?id=mainstage--resizing-transcript&viewMode=story",
    );
    const history = page.getByRole("log");
    await expect(history).toBeVisible();
    await expect
      .poll(() =>
        history.evaluate(
          (element) =>
            element.scrollHeight - element.clientHeight - element.scrollTop,
        ),
      )
      .toBeLessThanOrEqual(1);
    if (!following) {
      await history.evaluate((element) => {
        element.scrollTop = 100;
      });
      await page.waitForTimeout(50);
    }
    for (const expanded of [true, false, true, false]) {
      const samples = await history.evaluate(async (element, expanded) => {
        const toggle = element
          .closest(".spg-stage-content")!
          .querySelector<HTMLButtonElement>("header button")!;
        toggle.click();
        const samples: { gap: number; top: number; height: number }[] = [];
        const start = performance.now();
        while (performance.now() - start < 650) {
          // Sample after layout and ResizeObserver delivery for this frame.
          await new Promise((resolve) =>
            requestAnimationFrame(() => setTimeout(resolve, 0)),
          );
          samples.push({
            gap:
              element.scrollHeight - element.clientHeight - element.scrollTop,
            top: element.scrollTop,
            height: element.clientHeight,
          });
        }
        if (toggle.getAttribute("aria-expanded") !== String(expanded))
          throw new Error("Toggle failed");
        return samples;
      }, expanded);
      expect(
        new Set(samples.map((sample) => sample.height)).size,
      ).toBeGreaterThan(2);
      for (const sample of samples) {
        expect(
          Math.abs(following ? sample.gap : sample.top - 100),
        ).toBeLessThanOrEqual(1);
      }
      await page.getByRole("button", { name: "Append message" }).click();
      await expect.poll(() => history.evaluate((element) => ({
        gap: element.scrollHeight - element.clientHeight - element.scrollTop,
        top: element.scrollTop,
      })).then(({ gap, top }) => Math.abs(following ? gap : top - 100)))
        .toBeLessThanOrEqual(1);
    }
  });
}

for (const input of ["wheel", "ArrowDown", "PageDown", "Space", "End"]) {
  test(`native ${input} collapses only when its scroll reaches bottom`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(
      "/iframe.html?id=mainstage--resizing-transcript&viewMode=story",
    );
    const history = page.getByRole("log");
    const toggle = page.locator(".spg-stage-header button");
    await toggle.click();
    await history.focus();
    await history.press("Home");
    await expect(history).toHaveJSProperty("scrollTop", 0);
    await page.waitForTimeout(250);
    const gesture = async () => {
      if (input === "wheel") {
        await history.hover();
        await page.mouse.wheel(0, 100);
      } else await history.press(input);
    };
    if (input !== "End") {
      await gesture();
      await expect
        .poll(() => history.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(0);
      await page.waitForTimeout(300);
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      // Completed downward input must not authorize a later programmatic scroll.
      await history.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(100);
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await page.getByRole("button", { name: "Append message" }).click();
      await page.setViewportSize({ width: 1280, height: 850 });
      await page.waitForTimeout(100);
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
    }
    await history.evaluate((el) => {
      el.scrollTop = el.scrollHeight - el.clientHeight - 30;
    });
    await page.waitForTimeout(100);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    if (input === "wheel") {
      await history.hover();
      await page.mouse.wheel(0, 10);
      await expect
        .poll(() =>
          history.evaluate(
            (el) => el.scrollHeight - el.clientHeight - el.scrollTop,
          ),
        )
        .toBeLessThan(30);
      await page.waitForTimeout(250);
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
    }
    await gesture();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
}

test("native touch scroll stays expanded midstream and collapses at bottom", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(
    "/iframe.html?id=mainstage--resizing-transcript&viewMode=story",
  );
  const history = page.getByRole("log");
  const toggle = page.locator(".spg-stage-header button");
  await toggle.click();
  await history.evaluate((el) => {
    el.scrollTop = 100;
  });
  await page.waitForTimeout(100);
  const session = await context.newCDPSession(page);
  const swipe = async () => {
    const rect = (await history.boundingBox())!;
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height * 0.8;
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 6; step++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y - step * 20 }],
      });
      await page.waitForTimeout(30);
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  };
  await swipe();
  await expect
    .poll(() => history.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(100);
  await page.waitForTimeout(350);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await history.evaluate((el) => {
    el.scrollTop = el.scrollHeight - el.clientHeight - 30;
  });
  await page.waitForTimeout(100);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await swipe();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await session.detach();
});
