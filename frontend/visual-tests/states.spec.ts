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
  test(`model picker search is usable at ${width}px`, async ({ page }, testInfo) => {
    await openScene(page, "new-task", width);

    await page.getByRole("button", { name: "Model" }).click();
    const popover = page.locator(".desktop-select-popover").first();
    const search = page.getByRole("textbox", { name: "Search models" });
    await expect(search).toBeFocused();
    await expect(popover.getByText("Default", { exact: true })).toBeVisible();
    await expect(popover.getByRole("option", { name: /GPT-5.6/ })).toBeVisible();
    await expect(popover.getByRole("option", { name: /DeepSeek Coder/ })).toBeVisible();

    await search.fill("deep");
    await expect(popover.getByRole("option", { name: /GPT-5.6/ })).not.toBeVisible();
    await expect(popover.getByRole("option", { name: /DeepSeek Coder/ })).toBeVisible();

    const bounds = await popover.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(width);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeLessThanOrEqual(900);
    await capture(page, testInfo, "model-search", width);
  });

  test(`permission picker explains risk levels at ${width}px`, async ({ page }, testInfo) => {
    await openScene(page, "new-task", width);

    await page.getByRole("button", { name: "Permissions" }).click();
    const popover = page.locator(".desktop-select-popover").first();
    await expect(popover.getByText("Inspect the project and use non-mutating tools", { exact: true })).toBeVisible();
    await expect(popover.getByText("Edit project files and run project commands", { exact: true })).toBeVisible();
    await expect(popover.getByText("Broader tool access; high-impact actions still require explicit approval", { exact: true })).toBeVisible();

    const bounds = await popover.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(width);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeLessThanOrEqual(900);
    await capture(page, testInfo, "permission-picker", width);
  });

  test(`provider editor is usable at ${width}px`, async ({ page }, testInfo) => {
    await openScene(page, "providers", width);
    const card = page.locator(".provider-card").filter({ hasText: "OpenAI" }).first();
    await card.locator(".provider-expand").click();
    await card.locator('.provider-card-actions button[aria-label="Edit"]').click();

    await expect(card.locator(".provider-form")).toBeVisible();
    const baseURL = card.locator(".provider-form label").filter({ hasText: "Base URL" }).locator("input");
    await expect(baseURL).toHaveValue("https://api.openai.com/v1");
    await capture(page, testInfo, "providers-edit", width);
  });

  test(`provider advanced json is usable at ${width}px`, async ({ page }, testInfo) => {
    await openScene(page, "providers", width);
    await page.getByRole("button", { name: "Advanced JSON" }).click();

    const editor = page.getByRole("textbox", { name: "Advanced JSON" });
    const save = page.getByRole("button", { name: "Save JSON" });
    await expect(editor).toBeVisible();
    await expect(save).toBeDisabled();
    await editor.fill((await editor.inputValue()) + "\n");
    await expect(save).toBeEnabled();
    await capture(page, testInfo, "providers-advanced", width);
  });

  test(`provider delete dialog restores focus at ${width}px`, async ({ page }, testInfo) => {
    await openScene(page, "providers", width);
    const card = page.locator(".provider-card").filter({ hasText: "OpenAI" }).first();
    const deleteTrigger = card.locator('.provider-card-actions button[aria-label="Delete"]');
    await deleteTrigger.click();

    const dialog = page.getByRole("dialog", { name: "Delete" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Delete" })).toBeVisible();
    await capture(page, testInfo, "providers-delete-dialog", width);

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(deleteTrigger).toBeFocused();
  });

  test(`inspector select popover stays in viewport at ${width}px`, async ({ page }, testInfo) => {
    await openScene(page, "inspector", width);
    await page.locator(".inspector-tabs").getByRole("button", { name: "Run" }).click();

    const trigger = page.locator(".settings-desktop-select").first();
    await trigger.focus();
    await trigger.press("ArrowDown");
    const listbox = page.getByRole("listbox").first();
    await expect(listbox).toBeVisible();
    const bounds = await page.locator(".desktop-select-popover").first().evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    });
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.bottom).toBeLessThanOrEqual(900);
    await capture(page, testInfo, "inspector-select", width);

    await page.keyboard.press("Escape");
    await expect(listbox).not.toBeVisible();
    await expect(trigger).toBeFocused();
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
    if (width === 560) {
      const saveWidth = await page.getByRole("button", { name: "Save" }).evaluate((element) => element.getBoundingClientRect().width);
      expect(saveWidth).toBeLessThan(160);
    }
    await capture(page, testInfo, "extensions-permissions", width);
  });

  test(`inspector run state is usable at ${width}px`, async ({ page }, testInfo) => {
    await openScene(page, "inspector", width);
    await page.locator(".inspector-tabs").getByRole("button", { name: "Run" }).click();

    await expect(page.locator(".run-settings")).toBeVisible();
    await expect(page.getByText("Working memory", { exact: true })).toBeVisible();
    const subagentTitleSpacing = await page.locator(".subagent-group > .settings-title").evaluate((element) => {
      const children = Array.from(element.children) as HTMLElement[];
      const title = children[0]?.getBoundingClientRect();
      const count = children[1]?.getBoundingClientRect();
      return title && count ? count.left - title.right : 0;
    });
    expect(subagentTitleSpacing).toBeGreaterThan(4);
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
