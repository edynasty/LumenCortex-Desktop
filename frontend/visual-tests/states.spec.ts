import { expect, test, type Page, type TestInfo } from "@playwright/test";

const widths = [1440, 560] as const;

async function openScene(page: Page, scene: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/visual.html?scene=${scene}`);
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

async function capture(page: Page, testInfo: TestInfo, name: string, width: number) {
  await expectBounded(page);
  await page.screenshot({
    path: testInfo.outputPath(`${name}-${width}.png`),
    fullPage: true,
  });
}

for (const width of widths) {
  test(`provider editor is usable at ${width}px`, async ({ page }, testInfo) => {
    await openScene(page, "providers", width);
    const card = page.locator(".provider-card").filter({ hasText: "OpenAI" }).first();
    await card.locator(".provider-expand").click();
    await card.locator('.provider-card-actions button[aria-label="Edit"]').click();

    await expect(card.locator(".provider-form")).toBeVisible();
    const baseURL = card.locator(".provider-form label").filter({ hasText: "Base URL" }).locator("input");\n    await expect(baseURL).toHaveValue("https://api.openai.com/v1");
    await capture(page, testInfo, "providers-edit", width);
  });

  test(`review split mode is bounded at ${width}px`, async ({ page }, testInfo) => {
    await openScene(page, "review", width);
    await page.getByRole("radio", { name: "Split" }).click();

    await expect(page.locator(".review-split")).toBeVisible();
    await expect(page.locator(".split-row").first()).toBeVisible();
    await capture(page, testInfo, "review-split", width);
  });

  test(`extensions skills state is usable at ${width}px`, async ({ page }, testInfo) => {
    await openScene(page, "extensions", width);
    await page.getByRole("tab", { name: "Skills" }).click();

    await expect(page.locator(".skills-layout")).toBeVisible();
    await expect(page.getByText("Desktop UI", { exact: true })).toBeVisible();
    await expect(page.locator(".skill-editor textarea")).toHaveValue(/Keep LumenCortex dense/);
    await capture(page, testInfo, "extensions-skills", width);
  });

  test(`extensions permissions state is usable at ${width}px`, async ({ page }, testInfo) => {
    await openScene(page, "extensions", width);
    await page.getByRole("tab", { name: "Permissions" }).click();

    await expect(page.locator(".tool-permissions-panel")).toBeVisible();
    expect(await page.locator(".tool-permission-row").count()).toBeGreaterThan(10);
    await expect(page.locator(".tool-permission-row.disabled").filter({ hasText: "shell" })).toBeVisible();
    await capture(page, testInfo, "extensions-permissions", width);
  });

  test(`inspector run state is usable at ${width}px`, async ({ page }, testInfo) => {
    await openScene(page, "inspector", width);
    await page.locator(".inspector-tabs").getByRole("button", { name: "Run" }).click();

    await expect(page.locator(".run-settings")).toBeVisible();
    await expect(page.getByText("Working memory", { exact: true })).toBeVisible();
    await capture(page, testInfo, "inspector-run", width);
  });

  test(`inspector terminal state is usable at ${width}px`, async ({ page }, testInfo) => {
    await openScene(page, "inspector", width);
    await page.locator(".inspector-tabs").getByRole("button", { name: "Terminal" }).click();

    await expect(page.locator(".terminal-pane")).toBeVisible();
    await expect(page.locator(".terminal-pane textarea")).toHaveValue("npm test");
    await capture(page, testInfo, "inspector-terminal", width);
  });
}
