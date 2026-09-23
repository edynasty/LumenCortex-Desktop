import { expect, test, type Page, type TestInfo } from "@playwright/test";

const scenes = [
  ["new-task", ".new-task-workspace", "想让 LumenCortex 做什么？"],
  ["providers", ".topbar", "模型与提供商"],
  ["review", ".topbar", "审查"],
  ["extensions", ".topbar", "扩展"],
] as const;

async function openChineseScene(page: Page, scene: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/visual.html?scene=${scene}&locale=zh-CN`);
  await page.waitForLoadState("networkidle");
}

async function expectBounded(page: Page) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - window.innerWidth,
    body: document.body.scrollWidth - window.innerWidth,
    shell: Math.max(0, (document.querySelector(".app-shell")?.scrollWidth || 0) - window.innerWidth),
  }));
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);
  expect(overflow.shell).toBeLessThanOrEqual(1);
}

for (const width of [1440, 560] as const) {
  for (const [scene, visibleRoot, expectedCopy] of scenes) {
    test(`Chinese ${scene} stays usable at ${width}px`, async ({ page }, testInfo: TestInfo) => {
      await openChineseScene(page, scene, width);
      await expect(page.locator(visibleRoot).getByText(expectedCopy, { exact: true })).toBeVisible();
      if (width > 820) {
        await expect(page.getByText("新任务", { exact: true }).first()).toBeVisible();
      }
      await expectBounded(page);

      await page.screenshot({
        path: testInfo.outputPath(`zh-${scene}-${width}.png`),
        fullPage: true,
      });
    });
  }
}

test("Chinese provider scene uses localized provider controls", async ({ page }) => {
  await openChineseScene(page, "providers", 1440);
  await expect(page.getByText("快速添加", { exact: true })).toBeVisible();
  await expect(page.getByText("高级配置 JSON", { exact: true })).toBeVisible();
});

test("Chinese review scene uses localized diff controls", async ({ page }) => {
  await openChineseScene(page, "review", 1440);
  await expect(page.getByRole("radio", { name: "统一" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "分栏" })).toBeVisible();
});
