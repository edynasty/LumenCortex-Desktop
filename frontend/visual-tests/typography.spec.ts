import { expect, test, type Page } from "@playwright/test";

async function fontSize(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize)
  );
}

test("primary desktop metadata stays above the readability floor", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/visual.html?scene=providers");
  await page.waitForLoadState("networkidle");
  expect(await fontSize(page, ".provider-card-copy small")).toBeGreaterThanOrEqual(9.5);

  await page.goto("/visual.html?scene=inspector");
  await page.waitForLoadState("networkidle");
  await page.locator(".inspector-tabs").getByRole("button", { name: "Run" }).click();
  expect(await fontSize(page, ".settings-note")).toBeGreaterThanOrEqual(9.5);

  await page.goto("/visual.html?scene=thread");
  await page.waitForLoadState("networkidle");
  expect(await fontSize(page, ".thread-group-title")).toBeGreaterThanOrEqual(9.5);

  await page.goto("/visual.html?scene=new-task");
  await page.waitForLoadState("networkidle");
  expect(await fontSize(page, ".new-task-hint")).toBeGreaterThanOrEqual(9.5);
});
