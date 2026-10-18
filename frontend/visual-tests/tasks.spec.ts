import { expect, test, type Page } from "@playwright/test";

const widths = [1440, 1180, 820, 560] as const;

async function openTasks(page: Page, width: number, theme = "light") {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/visual.html?scene=tasks&theme=${theme}`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("region", { name: "Execution tasks" })).toBeVisible();
}

async function expectBounded(page: Page) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - window.innerWidth,
    tasks: Math.max(0, ...Array.from(document.querySelectorAll(".task-row, .execution-tasks, .composer-footer")).map((el) => el.scrollWidth - el.clientWidth)),
  }));
  expect(overflow.document).toBeLessThanOrEqual(1);
  expect(overflow.tasks).toBeLessThanOrEqual(1);
}

for (const width of widths) {
  test(`execution tasks stay readable and bounded at ${width}px`, async ({ page }, testInfo) => {
    await openTasks(page, width);
    const tasks = page.getByRole("region", { name: "Execution tasks" });

    // The run ended; the objective did not: both are shown, and they differ.
    await expect(page.locator(".status-pill")).toHaveText("Turn ended");
    await expect(page.locator(".resolution-pill")).toHaveText("Open");
    await expect(page.locator(".final-result")).not.toHaveClass(/settled/);

    // Each state Core reports is distinct; none of them reads as a done objective.
    await expect(tasks.locator(".task-row.phase-proposed .task-phase")).toHaveText("Awaiting your start");
    await expect(tasks.locator(".task-row.phase-running .task-phase")).toHaveText("Running");
    await expect(tasks.locator(".task-row.phase-waiting_gate .task-phase")).toHaveText("Needs approval");
    await expect(tasks.locator(".task-row.phase-failed .task-phase")).toHaveText("Failed");
    await expect(tasks.locator(".task-row.phase-finished .task-phase")).toHaveText("Finished · review");
    await expect(tasks.locator(".task-row.phase-finished")).toContainText("Checks passed");
    await expect(tasks.locator(".task-row.phase-failed")).toContainText("provider returned 429");
    await expect(page.locator(".message-row.task-result")).toHaveCount(3);

    await expect(page.getByRole("button", { name: "Delegation" })).toContainText("Propose");
    await expectBounded(page);
    await page.screenshot({ path: testInfo.outputPath(`tasks-${width}.png`), fullPage: true });
  });
}

test("a proposal shows as running only after Core reports it started; Stop reports what was cancelled", async ({ page }, testInfo) => {
  await openTasks(page, 1180);
  const tasks = page.getByRole("region", { name: "Execution tasks" });
  const proposal = tasks.locator(".task-row.phase-proposed");
  await expect(proposal).toHaveCount(1);

  await proposal.getByRole("button", { name: "Start" }).click();
  await expect(tasks.locator(".task-row.phase-proposed")).toHaveCount(0);
  await expect(tasks.locator(".task-row.phase-running")).toHaveCount(2);

  // Stop one task: the stub's CancelSubtree ends it interrupted; the other keeps running.
  const running = tasks.locator(".task-row.phase-running").first();
  await running.getByRole("button", { name: /^Stop:/ }).click();
  await expect(tasks.locator(".task-row.phase-running")).toHaveCount(1);
  await expect(tasks.locator(".task-row.phase-interrupted")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("tasks-after-actions.png"), fullPage: true });
});

test("the delegation grant offers the three modes with their authority", async ({ page }, testInfo) => {
  await openTasks(page, 1180);
  await page.getByRole("button", { name: "Delegation" }).click();
  const list = page.getByRole("listbox", { name: "Delegation" });
  await expect(list.getByRole("option")).toHaveCount(3);
  await expect(list).toContainText("Applies from the next turn");
  await page.screenshot({ path: testInfo.outputPath("tasks-delegation-menu.png") });
  await list.getByRole("option", { name: /Isolated/ }).click();
  await expect(page.getByRole("button", { name: "Delegation" })).toContainText("Isolated");
});

test("execution tasks render in the dark theme", async ({ page }, testInfo) => {
  await openTasks(page, 1180, "dark");
  await expectBounded(page);
  await page.screenshot({ path: testInfo.outputPath("tasks-dark-1180.png"), fullPage: true });
});
