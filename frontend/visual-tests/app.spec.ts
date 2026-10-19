/**
 * Production UI regression suite. Runs the real App (visual.html) over the in-memory Core in
 * src/visual/app-stub.ts and reaches every surface the way a user does: rail, sidebar rows,
 * toolbar, shortcuts. Each test guards a defect class from the Lumen Glass acceptance: duplicated
 * navigation, sidebar collapse/resize, clipped controls and text and wrapped toolbars at real
 * window widths, file names lost in paths, invisible keyboard focus, motion that ignores the OS
 * setting, console errors, and the brand mark.
 *
 * Geometry is measured with reduced motion so transitions cannot race the measurement.
 */
import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [1440, 1180, 820, 560] as const;

async function open(page: Page, query = "", width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/visual.html?locale=en&${query}`);
  await page.locator(".lc-window").waitFor();
  await page.waitForTimeout(150); // ResizeObserver-driven layout settles in a frame or two
}

const nav = (page: Page) => page.getByRole("navigation", { name: "Main navigation" });

/** Switches rail page; below 820px the rail rides in the sidebar drawer, as in the Demo. */
async function goToPage(page: Page, name: RegExp) {
  if (!(await nav(page).isVisible())) await page.getByRole("button", { name: /Toggle sidebar/ }).click();
  await nav(page).getByRole("button", { name }).click();
}

/** Opens a thread from the sidebar; below 820px the sidebar is a drawer behind the toolbar button. */
async function openThread(page: Page, title: string) {
  const row = page.locator(".sidebar").getByText(title, { exact: true }).first();
  if (!(await row.isVisible())) await page.getByRole("button", { name: /Toggle sidebar/ }).click();
  await row.click();
  await expect(page.locator(".toolbar-title")).toContainText(title);
}

/** Text cut off without an ellipsis: an overflow-hidden element whose own text is wider than its box. */
function hardClippedText(page: Page) {
  return page.evaluate(() => {
    const bad: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(".lc-window *")) {
      if (el.closest("[aria-hidden=true]") || !el.offsetParent) continue;
      const ownText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
      if (!ownText) continue;
      const cs = getComputedStyle(el);
      // text-overflow only applies to block containers; in a flex/grid container the text is cut hard.
      const ellipsis = cs.textOverflow === "ellipsis" && !/(flex|grid)/.test(cs.display);
      if (!/(hidden|clip)/.test(cs.overflowX) || ellipsis) continue;
      if (el.scrollWidth > el.clientWidth + 1) bad.push(`${el.className || el.tagName}: "${el.textContent!.trim().slice(0, 40)}"`);
    }
    return bad;
  });
}

/** Interactive controls clipped horizontally by their nearest non-scrolling overflow container. */
function clippedControls(page: Page) {
  return page.evaluate(() => {
    const bad: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(".lc-window button, .lc-window input, .lc-window select, .lc-window textarea")) {
      if (el.closest("[aria-hidden=true]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || getComputedStyle(el).visibility === "hidden") continue;
      let p = el.parentElement;
      while (p && getComputedStyle(p).overflowX === "visible") p = p.parentElement;
      if (!p) continue;
      if (/(auto|scroll)/.test(getComputedStyle(p).overflowX) && p.scrollWidth > p.clientWidth + 1) continue;
      const pr = p.getBoundingClientRect();
      if (r.left < pr.left - 1 || r.right > pr.right + 1) {
        const label = (el.getAttribute("aria-label") || el.textContent || el.className).trim().slice(0, 40);
        bad.push(`${el.tagName.toLowerCase()} "${label}" outside ${p.className.split(" ")[0]}`);
      }
    }
    return bad;
  });
}

async function toolbarOnOneLine(page: Page) {
  const toolbar = page.locator(".lc-window > .toolbar");
  const height = (await toolbar.boundingBox())!.height;
  const overflowing = await toolbar.evaluate((t) =>
    [...t.querySelectorAll<HTMLElement>("button, .toolbar-title")].filter((e) => {
      const r = e.getBoundingClientRect();
      const tr = t.getBoundingClientRect();
      return r.height > 0 && (r.top < tr.top - 1 || r.bottom > tr.bottom + 1);
    }).length);
  expect(height).toBeLessThanOrEqual(56);
  expect(overflowing).toBe(0);
}

test.describe("window shell", () => {
  test("one global navigation; each page keeps its selection", async ({ page }) => {
    await open(page);
    await expect(nav(page)).toHaveCount(1);
    await openThread(page, "Provider settings refactor");

    await nav(page).getByRole("button", { name: /^Source Control/ }).click();
    await expect(nav(page).getByRole("button", { name: /^Source Control/ })).toHaveAttribute("aria-current", "page");
    await nav(page).getByRole("button", { name: /^Threads/ }).click();
    await expect(page.locator(".toolbar-title")).toContainText("Provider settings refactor");
  });

  test("sidebar collapses, restores and resizes within bounds", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: /Toggle sidebar/ }).click();
    await expect(page.locator(".lc-window")).toHaveClass(/no-sidebar/);
    await page.keyboard.press("ControlOrMeta+b");
    await expect(page.locator(".lc-window")).toHaveClass(/has-sidebar/);

    const handle = page.getByRole("separator", { name: "Resize sidebar" });
    const min = Number(await handle.getAttribute("aria-valuemin"));
    const max = Number(await handle.getAttribute("aria-valuemax"));
    await handle.focus();
    await page.keyboard.press("End");
    await expect(handle).toHaveAttribute("aria-valuenow", String(max));
    await page.keyboard.press("Home");
    await expect(handle).toHaveAttribute("aria-valuenow", String(min));
    expect(Math.round((await page.locator(".sidebar-frame").boundingBox())!.width)).toBe(min);
  });

  test("inspector opens inline at 1440 and as a drawer at 820", async ({ page }) => {
    await open(page);
    await openThread(page, "Provider settings refactor");
    await page.keyboard.press("ControlOrMeta+i");
    await expect(page.locator(".lc-window")).toHaveClass(/has-inspector/);

    await open(page, "", 820);
    await openThread(page, "Provider settings refactor");
    await page.keyboard.press("ControlOrMeta+i");
    await expect(page.locator(".lc-window")).not.toHaveClass(/has-inspector/);
    await expect(page.locator(".drawer-end[role=dialog][aria-modal=true]")).toBeVisible();
  });

  test("command palette opens with the shortcut and runs an action", async ({ page }) => {
    await open(page);
    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeVisible();
    await page.keyboard.type("Models");
    await page.keyboard.press("Enter");
    await expect(palette).toBeHidden();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  });

  test("welcome shows the A1 mark and opens a project", async ({ page }) => {
    await open(page, "project=none");
    await expect(page.getByRole("img", { name: "LumenCortex" }).first()).toBeVisible();
    await expect(page.locator(".lc-window").getByText(/^LC$/)).toHaveCount(0);
  });
});

test.describe("layout at real window widths", () => {
  const routes: Array<[string, (page: Page) => Promise<void>]> = [
    ["new thread", async () => undefined],
    ["thread", (page) => openThread(page, "Provider settings refactor")],
    ["tasks", (page) => openThread(page, "Provider settings in tasks")],
    ["approval", (page) => openThread(page, "Session tags migration")],
    ["failed", (page) => openThread(page, "Upgrade SQLite driver")],
    ["changes", async (page) => {
      await openThread(page, "Provider settings refactor");
      await page.getByRole("radio", { name: "Changes" }).click();
    }],
    ["source control", (page) => goToPage(page, /^Source Control/)],
    ["context", (page) => goToPage(page, /^Context/)],
  ];

  for (const width of WIDTHS) {
    for (const [name, reach] of routes) {
      test(`${name} @${width}: no clipped controls or text, toolbar on one line`, async ({ page }) => {
        await open(page, "", width);
        await reach(page);
        await page.waitForTimeout(200);
        expect(await clippedControls(page)).toEqual([]);
        expect(await hardClippedText(page)).toEqual([]);
        await toolbarOnOneLine(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  }

  test("paths shorten the directory before the file name", async ({ page }) => {
    for (const width of WIDTHS) {
      await open(page, "", width);
      await openThread(page, "Provider settings refactor");
      const lost = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".lc-window .path")].filter((p) => {
        const name = p.querySelector<HTMLElement>(".path-name");
        const dir = p.querySelector<HTMLElement>(".path-dir");
        if (!name || !p.offsetParent) return false;
        const nameCut = name.scrollWidth > name.clientWidth + 1;
        const dirCut = !dir || dir.scrollWidth > dir.clientWidth + 1;
        return nameCut && !dirCut;
      }).map((p) => p.title));
      expect(lost, `@${width}`).toEqual([]);
    }
  });

  test("project switcher menu stays inside the window at every width", async ({ page }) => {
    await page.addInitScript((projects: string[]) => {
      localStorage.setItem("lcx-recent-projects", JSON.stringify(projects));
    }, [
      "/Users/demo/Projects/lumencortex",
      "/Users/demo/Projects/really-long-workspace-directory-name-for-geometry-checks",
    ]);
    for (const width of WIDTHS) {
      await open(page, "", width);
      const trigger = page.locator(".project-button");
      // Below 880px the sidebar lives in the drawer; open it like a user would.
      if (!(await trigger.isVisible())) {
        await page.getByRole("button", { name: /Toggle sidebar/ }).click();
        await expect(trigger).toBeVisible();
      }
      await expect(page.locator(".project-button .project-name")).toHaveText(/lumencortex/i);
      await trigger.click();
      const menu = page.locator(".project-menu-popover");
      await expect(menu).toBeVisible();
      // Portaled to the body, so neither the sidebar frame nor the drawer can clip it.
      expect(await page.evaluate(() => document.querySelector(".project-menu-popover")?.parentElement === document.body), `portal @${width}`).toBe(true);
      const box = (await menu.boundingBox())!;
      expect(box.y, `top @${width}`).toBeGreaterThanOrEqual(0);
      expect(box.x, `left @${width}`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `right @${width}`).toBeLessThanOrEqual(width + 1);
      expect(box.y + box.height, `bottom @${width}`).toBeLessThanOrEqual(900 + 1);
      // The menu sizes to its content, never to the trigger width.
      const triggerBox = (await trigger.boundingBox())!;
      expect(box.width, `width @${width}`).toBeGreaterThan(triggerBox.width);
      // Names stay complete (wrap, not silent truncation) and every path keeps its tooltip.
      const problems = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>(".project-menu-popover")!;
        const clippedNames = [...el.querySelectorAll<HTMLElement>(".project-menu-name")]
          .filter((name) => name.scrollWidth > name.clientWidth + 1)
          .map((name) => name.textContent);
        const pathsWithoutTooltip = [...el.querySelectorAll<HTMLElement>(".project-menu-item")]
          .filter((row) => row.querySelector(".project-menu-path") && !row.title.startsWith("/"))
          .map((row) => row.textContent);
        const menuClipped = el.scrollWidth > el.clientWidth + 1 ? ["menu-hscroll"] : [];
        return [...clippedNames, ...pathsWithoutTooltip, ...menuClipped];
      });
      expect(problems, `content @${width}`).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      expect(await page.evaluate(() => document.activeElement?.className), `focus @${width}`).toContain("project-button");
    }
  });
});

test.describe("accessibility", () => {
  test("keyboard focus is visible on the rail", async ({ page }) => {
    await open(page);
    const first = nav(page).getByRole("button").first();
    await first.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    const ring = await first.evaluate((el) => {
      const cs = getComputedStyle(el);
      return el.matches(":focus-visible") && ((cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== "none");
    });
    expect(ring).toBe(true);
  });

  test("reduced motion stops long animations", async ({ page }) => {
    await open(page);
    await openThread(page, "Provider settings refactor");
    const long = await page.evaluate(() => document.getAnimations().filter((a) => {
      const t = a.effect?.getComputedTiming();
      return t && (t.iterations === Infinity || Number(t.duration) > 1);
    }).length);
    expect(long).toBe(0);
  });

  test("icon-only buttons are labelled", async ({ page }) => {
    for (const width of [1440, 560]) {
      await open(page, "", width);
      await openThread(page, "Provider settings refactor");
      const unlabeled = await page.locator(".lc-window button:visible").evaluateAll((buttons) =>
        buttons
          .filter((b) => !(b.textContent || "").trim() && !b.getAttribute("aria-label") && !b.getAttribute("title"))
          .map((b) => b.outerHTML.slice(0, 160)));
      expect(unlabeled, `@${width}`).toEqual([]);
    }
  });
});

test("no console errors across pages, themes and locales", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const theme of ["light", "dark"]) {
    for (const locale of ["zh-CN", "en"]) {
      await page.goto(`/visual.html?theme=${theme}&locale=${locale}`);
      await page.locator(".lc-window").waitFor();
      for (const index of [1, 2, 0]) {
        // Locale-independent: the rail's accessible name is translated.
        await page.locator("nav.rail .rail-items button").nth(index).click();
        await page.waitForTimeout(100);
      }
    }
  }
  expect(errors).toEqual([]);
});

// Behaviour that crosses the bridge: every assertion follows what the in-memory Core answers.
test.describe("Core-backed interactions", () => {
  test("a proposal runs only after Core reports it started; Stop ends just that subtree", async ({ page }) => {
    await open(page, "", 1180);
    await openThread(page, "Provider settings in tasks");
    const tasks = page.getByRole("region", { name: "Execution tasks" });
    await expect(tasks.locator(".task-block.phase-proposed")).toHaveCount(1);
    await tasks.locator(".task-block.phase-proposed").getByRole("button", { name: "Start" }).click();
    await expect(tasks.locator(".task-block.phase-proposed")).toHaveCount(0);
    await expect(tasks.locator(".task-block.phase-running")).toHaveCount(2);
    await tasks.locator(".task-block.phase-running").first().getByRole("button", { name: /^Stop:/ }).click();
    await expect(tasks.locator(".task-block.phase-running")).toHaveCount(1);
    await expect(tasks.locator(".task-block.phase-interrupted")).toHaveCount(1);
  });

  test("a human gate offers Approve and the card leaves once Core clears the gate", async ({ page }) => {
    await open(page, "", 1180);
    await openThread(page, "Session tags migration");
    const gate = page.getByRole("region", { name: "Approval required" });
    await expect(gate.getByRole("heading", { name: "Apply migration 0007_session_tags" })).toBeVisible();
    await gate.getByRole("button", { name: "Approve" }).click();
    await expect(gate).toHaveCount(0);
  });

  test("the delegation grant offers three modes and records the choice", async ({ page }) => {
    await open(page, "", 1180);
    await openThread(page, "Provider settings in tasks");
    await page.getByRole("button", { name: /^Delegation:/ }).click();
    const menu = page.getByRole("menu", { name: "Delegation" });
    await expect(menu.getByRole("menuitemradio")).toHaveCount(3);
    await menu.getByRole("menuitemradio", { name: /Isolated/ }).click();
    await expect(page.getByRole("button", { name: /^Delegation:/ })).toHaveAccessibleName("Delegation: Isolated");
  });

  test("accepting a failing check records a human result from Core", async ({ page }) => {
    await open(page);
    await openThread(page, "Provider settings refactor");
    await page.keyboard.press("ControlOrMeta+i");
    await page.getByRole("radio", { name: "Checks", exact: true }).click();
    const failing = page.locator(".check-card").filter({ hasText: "go-test" });
    await failing.getByRole("button", { name: "Diff" }).click();
    await expect(page.locator(".check-artifact pre")).toContainText("out.Headers = workspace.Headers");
    await failing.getByRole("button", { name: "Accept current state" }).click();
    await expect(page.locator(".check-row").first()).toContainText("Accepted by desktop-user");
  });

  // toBeVisible ignores clipping by an overflow ancestor, so the picker is hit-tested.
  for (const width of WIDTHS) {
    test(`model picker receives clicks @${width}`, async ({ page }) => {
      await open(page, "", width);
      await page.getByRole("button", { name: /^Model:/ }).first().click();
      await expect(page.getByRole("textbox", { name: "Search models" })).toBeFocused();
      const misses = await page.evaluate(() => {
        const popover = document.querySelector(".model-popover");
        const targets = [...(popover?.querySelectorAll("input, [role=option]") ?? [])];
        if (!targets.length) return ["no picker targets"];
        return targets.flatMap((el) => {
          const r = el.getBoundingClientRect();
          const inView = r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return inView && hit && el.contains(hit) ? [] : [`${el.textContent || el.tagName}`];
        });
      });
      expect(misses).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("textbox", { name: "Search models" })).toHaveCount(0);
    });
  }


  // ————— Stage A composer: Ask/Agent, effort, model picker, execution environment —————

  test("Ask mode caps the permission and delegation controls and survives thread switching", async ({ page }) => {
    await open(page, "", 1180);
    await openThread(page, "Provider settings refactor");
    const mode = page.getByRole("button", { name: /^Mode:/ });
    await mode.click();
    await page.getByRole("menu", { name: "Mode" }).getByRole("menuitemradio", { name: /^Ask/ }).click();
    await expect(page.getByRole("button", { name: /^Mode:/ })).toHaveAccessibleName("Mode: Ask");

    // The two Core controls keep their state but are capped with an explanation while in Ask.
    const policy = page.getByRole("button", { name: /^Permissions:/ });
    await expect(policy).toBeDisabled();
    await expect(policy).toHaveAttribute("title", /Ask is always read-only/);
    const delegation = page.getByRole("button", { name: /^Delegation:/ });
    await expect(delegation).toBeDisabled();

    // The mode is app-level: switching threads keeps it.
    await openThread(page, "Upgrade SQLite driver");
    await expect(page.getByRole("button", { name: /^Mode:/ })).toHaveAccessibleName("Mode: Ask");

    // Switching back to Agent restores the controls.
    await page.getByRole("button", { name: /^Mode:/ }).click();
    await page.getByRole("menu", { name: "Mode" }).getByRole("menuitemradio", { name: /^Agent/ }).click();
    await expect(page.getByRole("button", { name: /^Permissions:/ })).toBeEnabled();
  });

  test("the effort picker offers only the selected model's levels and disables when fixed", async ({ page }) => {
    await open(page, "", 1180);
    // GPT-5.6 has efforts; the effort chip opens a menu with Default + its levels.
    await page.getByRole("button", { name: /^Effort:/ }).click();
    const menu = page.getByRole("menu", { name: "Effort" });
    await expect(menu.getByRole("menuitemradio")).toHaveCount(4);
    await menu.getByRole("menuitemradio", { name: "High" }).click();
    await expect(page.getByRole("button", { name: /^Effort:/ })).toHaveAccessibleName("Effort: High");

    // Switch to a model without efforts: the picker shows the not-configurable state.
    await page.getByRole("button", { name: /^Model:/ }).first().click();
    await page.getByRole("textbox", { name: "Search models" }).fill("mini");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: /^Effort:/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: /^Effort:/ })).toHaveAccessibleName("Effort: Effort fixed");
  });

  test("the model picker filters, shows reasons for refused models, keeps Recent, and re-pins on send", async ({ page }) => {
    await open(page, "", 1180);
    // An idle thread: its composer offers Resume (the active fixture thread shows Stop instead).
    await openThread(page, "Improve review diff rendering");
    const chip = page.getByRole("button", { name: /^Model:/ });
    await expect(chip).toHaveAccessibleName("Model: GPT-5.6");

    // A refused model (missing key) stays visible, disabled, with its reason.
    await chip.click();
    const listbox = page.getByRole("listbox", { name: "Model" });
    const noKey = listbox.getByRole("option", { name: /DeepSeek Chat/ });
    await expect(noKey).toBeDisabled();
    await expect(noKey).toContainText("API key not set");
    const noTools = listbox.getByRole("option", { name: /Embed Text/ });
    await expect(noTools).toBeDisabled();
    await expect(noTools).toContainText("No tool calling");

    // Keyboard: filter by upstream id, arrow to it, Enter picks it.
    await page.getByRole("textbox", { name: "Search models" }).fill("gpt-5.6-mini");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: /^Model:/ })).toHaveAccessibleName("Model: GPT-5.6 Mini");
    // The choice is pending: it is sent on the next turn, not yet what the session is pinned to.
    await expect(page.getByRole("button", { name: /^Model:/ })).toContainText("Pending");

    // Recent holds the pick; the provider group still lists it.
    await page.getByRole("button", { name: /^Model:/ }).click();
    await expect(page.getByRole("listbox", { name: "Model" }).getByText("Recent")).toBeVisible();
    await page.keyboard.press("Escape");

    // Sending applies it once: the stub re-pins like Core's model.user rule.
    await page.getByRole("textbox", { name: "Start another task" }).fill("continue with mini");
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByRole("button", { name: /^Model:/ })).toHaveAccessibleName("Model: GPT-5.6 Mini");
    await expect(page.getByRole("button", { name: /^Model:/ })).not.toContainText("Pending");
  });

  test("the execution environment is chosen on the new-task screen and read-only in a thread", async ({ page }) => {
    await open(page, "", 1180);
    // New task: the environment row offers Local/Worktree.
    const exec = page.getByRole("button", { name: /^Run environment:/ });
    await expect(exec).toBeVisible();
    await exec.click();
    await page.getByRole("menu", { name: "Run environment" }).getByRole("menuitemradio", { name: /^Worktree/ }).click();
    await expect(page.getByRole("button", { name: /^Run environment:/ })).toHaveAccessibleName("Run environment: Worktree");

    // An existing conversation shows the session's runtime identity as plain text, not a control.
    await openThread(page, "Provider settings refactor");
    await expect(page.locator(".composer-runtime .runtime-identity")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Run environment:/ })).toHaveCount(0);
  });

  test("the composer shortcuts focus the input and open the model picker", async ({ page }) => {
    await open(page, "", 1180);
    await openThread(page, "Provider settings refactor");
    await page.keyboard.press("ControlOrMeta+/");
    await expect(page.getByRole("textbox", { name: "Start another task" })).toBeFocused();
    await page.keyboard.press("ControlOrMeta+Shift+KeyM");
    await expect(page.getByRole("textbox", { name: "Search models" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Model:/ })).toBeFocused();
  });

  test("split diff is unavailable at the 820px compact breakpoint", async ({ page }) => {
    await open(page, "", 820);
    await openThread(page, "Provider settings refactor");
    await page.getByRole("radio", { name: "Changes" }).click();
    await expect(page.locator(".diff-view")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Split" })).toHaveCount(0);
  });

  test("picking a worktree from the compact drawer closes it and shows that worktree", async ({ page }) => {
    await open(page, "", 560);
    await goToPage(page, /Source Control/);
    // Switching pages closed the drawer; open it again to reach the checkout list.
    await page.getByRole("button", { name: /Toggle sidebar/ }).click();
    await page.locator(".scm-row").filter({ hasText: "lumencortex/demo" }).click();
    await expect(page.locator(".drawer")).toHaveCount(0);
    await expect(page.locator(".main-pane h2")).toContainText("lumencortex/demo");
  });
});

/** Opens Settings on the Models & providers pane, as the palette does. */
async function openProviderPane(page: Page) {
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await page.keyboard.type("Models");
  await page.keyboard.press("Enter");
  await expect(palette).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Models & providers" })).toBeVisible();
  await page.locator(".provider-row").filter({ hasText: "DeepSeek" }).click();
  await expect(page.getByText("Environment variable DEEPSEEK_API_KEY is not set")).toBeVisible();
}

test.describe("provider pane: protocol and Keychain credentials", () => {
  test("keeps the new controls unclipped at every window width", async ({ page }) => {
    for (const width of WIDTHS) {
      await open(page, "", width);
      await openThread(page, "Provider settings refactor");
      await openProviderPane(page);

      const pane = page.getByRole("dialog", { name: "Settings" });
      await expect(pane.getByRole("radiogroup", { name: "Source" })).toBeVisible();
      await pane.getByRole("radio", { name: "macOS Keychain" }).click();
      await expect(pane.getByRole("textbox", { name: "API key" })).toBeVisible();
      await pane.getByRole("button", { name: "Edit" }).first().click();
      await expect(pane.getByRole("radiogroup", { name: "Protocol" })).toBeVisible();
      await expect(pane.getByRole("radio", { name: "Anthropic Messages" })).toBeVisible();

      expect(await clippedControls(page)).toEqual([]);
      expect(await hardClippedText(page)).toEqual([]);
      await page.keyboard.press("Escape");
    }
  });

  test("Keychain save -> status -> remove flow over the stub bridge", async ({ page }) => {
    await open(page, "", 1180);
    await openThread(page, "Provider settings refactor");
    await openProviderPane(page);
    const pane = page.getByRole("dialog", { name: "Settings" });

    await pane.getByRole("radio", { name: "macOS Keychain" }).click();
    await pane.getByRole("textbox", { name: "API key" }).fill("sk-stub-NEVER-PRINT-2468");
    await pane.getByRole("button", { name: "Save" }).click();
    await expect(pane.getByText("Saved in Keychain")).toBeVisible();
    await expect(page.locator(".lc-window")).not.toContainText("sk-stub-NEVER-PRINT-2468");
    await expect(pane.getByRole("textbox", { name: "API key" })).toHaveValue("");

    await pane.getByRole("button", { name: "Remove" }).click();
    await pane.getByRole("button", { name: "Confirm removal" }).click();
    await expect(pane.getByText("No API key configured")).toBeVisible();
    await expect(page.locator(".lc-window")).not.toContainText("sk-stub-NEVER-PRINT-2468");
  });

  test("the stub bridge never returns the key value", async ({ page }) => {
    await open(page);
    const leaked = await page.evaluate(async () => {
      const app = window.go?.main?.App as Record<string, (...args: unknown[]) => Promise<unknown>> | undefined;
      if (!app) throw new Error("stub bridge is not installed");
      const marker = "sk-stub-NEVER-PRINT-1357";
      const after = await app.SaveProviderCredential("global", "deepseek", marker);
      const answers = await Promise.all([
        app.GetProviderCredentialStatus("global", "deepseek"),
        app.GetProviderCatalogScope("global"),
        app.GetConfigState(),
        app.TestProviderConnection("deepseek"),
        Promise.resolve(after),
      ]);
      return JSON.stringify(answers).includes(marker);
    });
    expect(leaked).toBe(false);
  });
});
