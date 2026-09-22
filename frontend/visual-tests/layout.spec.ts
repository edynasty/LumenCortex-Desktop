import { expect, test } from "@playwright/test";

const widths = [1440, 1180, 820, 560] as const;
const scenes = ["new-task", "thread", "providers", "review", "extensions", "inspector"] as const;

const sceneRoots: Record<(typeof scenes)[number], string> = {
  "new-task": ".new-task-workspace",
  thread: ".thread-view",
  providers: ".provider-settings",
  review: ".review-workspace",
  extensions: ".extensions-workspace",
  inspector: ".inspector",
};

for (const width of widths) {
  for (const scene of scenes) {
    test(`${scene} has bounded desktop layout at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/visual.html?scene=${scene}`);
      await page.waitForLoadState("networkidle");
      await expect(page.locator(sceneRoots[scene])).toBeVisible();

      const overflow = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth - window.innerWidth,
        body: document.body.scrollWidth - window.innerWidth,
        shell: Math.max(0, (document.querySelector(".app-shell")?.scrollWidth || 0) - window.innerWidth),
      }));
      expect(overflow.document).toBeLessThanOrEqual(1);
      expect(overflow.body).toBeLessThanOrEqual(1);
      expect(overflow.shell).toBeLessThanOrEqual(1);

      const sidebarStyle = await page.locator(".sidebar").evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          display: style.display,
          flexDirection: style.flexDirection,
          borderRightStyle: style.borderRightStyle,
        };
      });
      expect(sidebarStyle).toEqual({
        display: "flex",
        flexDirection: "column",
        borderRightStyle: "solid",
      });

      if (width > 820) {
        await expect(page.getByRole("button", { name: "Open sidebar" })).toBeHidden();
        await expect(page.locator(".sidebar .mobile-only")).toBeHidden();
      } else {
        await expect(page.getByRole("button", { name: "Open sidebar" })).toBeVisible();
      }

      const unlabeledIconButtons = await page.locator("button:visible").evaluateAll((buttons) =>
        buttons
          .filter((button) => (button.textContent || "").trim() === "")
          .filter((button) => !button.getAttribute("aria-label") && !button.getAttribute("title"))
          .map((button) => button.outerHTML.slice(0, 240))
      );
      expect(unlabeledIconButtons).toEqual([]);

      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body) return null;
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          width: rect.width,
          height: rect.height,
          left: rect.left,
          right: rect.right,
        };
      });
      expect(focused).not.toBeNull();
      expect(focused!.width).toBeGreaterThan(0);
      expect(focused!.height).toBeGreaterThan(0);
      expect(focused!.right).toBeGreaterThan(0);
      expect(focused!.left).toBeLessThan(width);

      await page.screenshot({
        path: testInfo.outputPath(`${scene}-${width}.png`),
        fullPage: true,
      });

      if (scene === "review" && width === 560) {
        await expect(page.locator(".review-files")).toBeVisible();
        expect(await page.locator(".review-file-list button").count()).toBeGreaterThan(1);
      }

      if (scene === "inspector" && width === 560) {
        await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
        const inspectorWidth = await page.locator(".inspector").evaluate((element) => element.getBoundingClientRect().width);
        expect(inspectorWidth).toBeLessThanOrEqual(width);
      } else if (width <= 820) {
        const sidebarTrigger = page.getByRole("button", { name: "Open sidebar" });
        await sidebarTrigger.click();
        await expect(page.locator(".sidebar")).toHaveClass(/open/);
        await expect(page.locator(".sidebar").getByRole("button", { name: "Close" })).toBeFocused();
        const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(mobileOverflow).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: testInfo.outputPath(`${scene}-${width}-sidebar.png`),
          fullPage: true,
        });
        await page.keyboard.press("Escape");
        await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
        await expect(sidebarTrigger).toBeFocused();
      }
    });
  }
}
