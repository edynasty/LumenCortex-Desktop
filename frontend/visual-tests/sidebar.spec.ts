import { expect, test } from "@playwright/test";

for (const width of [820, 560] as const) {
  test(`mobile sidebar traps and restores keyboard focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/visual.html?scene=new-task");
    await page.waitForLoadState("networkidle");

    const trigger = page.getByRole("button", { name: "Open sidebar" });
    const sidebar = page.locator(".sidebar");
    await trigger.click();
    await expect(sidebar).toHaveClass(/open/);
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

    // Force focus back to the obscured background trigger to prove the modal
    // keyboard trap actively pulls the next Tab into the open sidebar.
    await trigger.focus();
    await page.keyboard.press("Tab");
    const focusInsideSidebar = await page.evaluate(() => {
      const openSidebar = document.querySelector(".sidebar.open");
      return Boolean(openSidebar && openSidebar.contains(document.activeElement));
    });
    expect(focusInsideSidebar).toBe(true);

    await page.keyboard.press("Escape");
    await expect(sidebar).not.toHaveClass(/open/);
    await expect(trigger).toBeFocused();
  });
}


for (const width of [1440, 560] as const) {
  test(`sidebar attention state stays visible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/visual.html?scene=new-task");
    await page.waitForLoadState("networkidle");

    if (width <= 820) {
      await page.getByRole("button", { name: "Open sidebar" }).click();
      await expect(page.locator(".sidebar")).toHaveClass(/open/);
    }

    const attentionGroup = page.locator(".thread-group.attention");
    await expect(attentionGroup.getByText("Needs attention", { exact: true })).toBeVisible();

    const attentionRow = page.locator(".thread-item-row.attention-warning");
    await expect(
      attentionRow.getByRole("button", {
        name: "Approve database migration · Waiting for approval",
      }),
    ).toBeVisible();

    const colors = await attentionRow.evaluate((element) => {
      const copy = element.querySelector(".thread-copy small");
      const dot = element.querySelector(".thread-dot");
      return {
        copy: copy ? getComputedStyle(copy).color : "",
        dot: dot ? getComputedStyle(dot).backgroundColor : "",
      };
    });
    expect(colors.copy).toBe(colors.dot);
  });
}
