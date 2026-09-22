import { expect, test } from "@playwright/test";

const widths = [1440, 560] as const;
const scenes = ["new-task", "thread", "providers", "review", "extensions", "inspector"] as const;

for (const width of widths) {
  for (const scene of scenes) {
    test(`dark theme ${scene} stays bounded at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/visual.html?scene=${scene}&theme=dark`);
      await page.waitForLoadState("networkidle");

      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      const theme = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        return {
          surface: root.getPropertyValue("--surface").trim(),
          text: root.getPropertyValue("--text").trim(),
          colorScheme: document.documentElement.style.colorScheme,
          documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
          bodyOverflow: document.body.scrollWidth - window.innerWidth,
        };
      });
      expect(theme.surface).toBe("#20211f");
      expect(theme.text).toBe("#ecece7");
      expect(theme.colorScheme).toBe("dark");
      expect(theme.documentOverflow).toBeLessThanOrEqual(1);
      expect(theme.bodyOverflow).toBeLessThanOrEqual(1);

      await page.screenshot({
        path: testInfo.outputPath(`dark-${scene}-${width}.png`),
        fullPage: true,
      });
    });
  }
}
