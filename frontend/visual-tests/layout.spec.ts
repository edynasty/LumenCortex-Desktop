import { expect, test } from "@playwright/test";

const widths = [1440, 1180, 820, 560] as const;
const scenes = ["new-task", "thread"] as const;

for (const width of widths) {
  for (const scene of scenes) {
    test(`${scene} has bounded desktop layout at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/visual.html?scene=${scene}`);
      await page.waitForLoadState("networkidle");

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

      if (width <= 820) {
        await page.getByRole("button", { name: "Open sidebar" }).click();
        await expect(page.locator(".sidebar")).toHaveClass(/open/);
        const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(mobileOverflow).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: testInfo.outputPath(`${scene}-${width}-sidebar.png`),
          fullPage: true,
        });
      }
    });
  }
}
