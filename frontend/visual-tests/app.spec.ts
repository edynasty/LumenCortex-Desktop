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

const WIDTHS = [1568, 1440, 1180, 820, 560] as const;

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

  test("the shell has one polite live region and a running thread carries its label beside the A1 glyph", async ({ page }) => {
    await open(page);
    await expect(page.locator(".lc-window > [role=status][aria-live=polite]")).toHaveCount(1);
    const running = page.locator(".thread-row", { has: page.locator(".lumen-indicator") }).first();
    await expect(running).toBeVisible();
    await expect(running.locator(".thread-row-status")).toHaveText(/\S/);
    await expect(page.locator(".shimmer, .spin, .thread-progress-bar")).toHaveCount(0);
  });

  test("a dismissed drawer plays its exit, stays inert, and returns focus at once", async ({ page }) => {
    await open(page, "", 820);
    await openThread(page, "Provider settings refactor");
    // Motion on: the suite default is reduced, which collapses the exit to 1 ms.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const toggle = page.getByRole("button", { name: /Toggle sidebar/ });
    await toggle.focus();
    await page.keyboard.press("ControlOrMeta+i");
    const drawer = page.locator(".drawer-end");
    await expect(drawer).toHaveAttribute("data-state", "open");
    await page.keyboard.press("Escape");
    // Right after Escape the layer is still mounted, closed, inert and click-through; focus is back.
    await expect(drawer).toHaveAttribute("data-state", "closed");
    await expect(drawer).toHaveAttribute("inert", "");
    expect(await drawer.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
    await expect(toggle).toBeFocused();
    await expect(drawer).toHaveCount(0);
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

  test("a 300-column diff line is readable by scrolling, in unified and split views", async ({ page }) => {
    await open(page, "", 1440);
    await openThread(page, "Provider settings refactor");
    await page.getByRole("radio", { name: "Changes" }).click();
    const long = page.locator(".diff-line code", { hasText: "longLine" });
    await expect(long).toBeVisible();
    const probe = () => page.evaluate(() => {
      const code = [...document.querySelectorAll<HTMLElement>(".diff-line code, .split-cell code")].find((el) => el.textContent?.includes("longLine"))!;
      const scroller = code.closest<HTMLElement>(".diff-scroll")!;
      const style = getComputedStyle(code);
      return {
        // The line is whole (no ellipsis clipping) and the scroller scrolls to reach its end.
        clipped: style.textOverflow === "ellipsis" && code.scrollWidth > code.clientWidth,
        scrolls: scroller.scrollWidth > scroller.clientWidth,
        codeFits: code.scrollWidth <= code.clientWidth + 1,
      };
    });
    const unified = await probe();
    expect(unified).toEqual({ clipped: false, scrolls: true, codeFits: true });
    await page.evaluate(() => { const s = document.querySelector<HTMLElement>(".diff-scroll")!; s.scrollLeft = s.scrollWidth; });
    await expect(long).toContainText("0123456789\";");
    expect(await long.evaluate((el) => { const r = el.getBoundingClientRect(); const s = el.closest(".diff-scroll")!.getBoundingClientRect(); return r.right <= s.right + 1; })).toBe(true);

    await page.getByRole("radio", { name: /Split/ }).click();
    expect(await probe()).toEqual({ clipped: false, scrolls: true, codeFits: true });
  });

  test("Increase Contrast makes content and float surfaces solid in both themes", async ({ page }) => {
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme, contrast: "more" });
      await open(page, "", 1180);
      await page.emulateMedia({ colorScheme: theme, contrast: "more", reducedMotion: "reduce" });
      const tokens = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const v = (name: string) => root.getPropertyValue(name).trim();
        return {
          theme: document.documentElement.dataset.theme,
          content: [v("--surface-content"), v("--surface-content-solid")],
          float: [v("--surface-float"), v("--surface-float-solid")],
          line: [v("--line"), v("--line-strong")],
          fg4: [v("--fg-4"), v("--fg-3")],
        };
      });
      expect(tokens.theme).toBe(theme);
      for (const [value, solid] of [tokens.content, tokens.float, tokens.line, tokens.fg4]) expect(value).toBe(solid);
    }
  });

  test("material: a drawer is solid, at most two layers blur, chrome is not selectable and content is", async ({ page }) => {
    await open(page, "", 820);
    await openThread(page, "Provider settings refactor");
    await page.getByRole("button", { name: /Toggle sidebar/ }).click();
    await expect(page.locator(".drawer-start")).toBeVisible();
    const probe = () => page.evaluate(() => {
      const blurred: string[] = [];
      for (const el of document.querySelectorAll("*")) {
        for (const pseudo of [null, "::before", "::after"]) {
          const style = getComputedStyle(el, pseudo);
          const filter = style.backdropFilter || style.getPropertyValue("-webkit-backdrop-filter");
          if (filter && filter !== "none") blurred.push(`${el.tagName.toLowerCase()}.${el.className}${pseudo ?? ""}`);
        }
      }
      const select = (selector: string) => {
        const el = document.querySelector(selector);
        return el ? (getComputedStyle(el).userSelect || getComputedStyle(el).getPropertyValue("-webkit-user-select")) : "missing";
      };
      return {
        blurred,
        drawerFilter: getComputedStyle(document.querySelector(".drawer-start")!).backdropFilter,
        chrome: [select(".toolbar"), select(".rail"), select(".thread-row"), select(".chip")],
        content: [select(".msg-assistant"), select(".msg-user")],
        overscroll: getComputedStyle(document.querySelector(".sidebar-scroll")!).overscrollBehaviorY,
      };
    });
    const state = await probe();
    expect(state.drawerFilter).toBe("none");
    expect(state.blurred.length, state.blurred.join(", ")).toBeLessThanOrEqual(2);
    expect(state.chrome).toEqual(["none", "none", "none", "none"]);
    expect(state.content).not.toContain("none");
    expect(state.overscroll).toBe("contain");
    // Titles are usually Chinese: no negative tracking (docs/frontend-development-standard.md).
    const tracking = await page.evaluate(() => [".toolbar-title h1", ".task-intro h1"].map((selector) => {
      const el = document.querySelector(selector);
      return el ? parseFloat(getComputedStyle(el).letterSpacing) || 0 : null;
    }));
    for (const value of tracking) expect(value === null || value >= 0).toBe(true);
  });

  test("with the native menu installed, menu commands act once and the webview keys stand down", async ({ page }) => {
    await open(page, "menu=native");
    const emit = (command: string) => page.evaluate((name) => (window as Window & { __lcxEmit: (n: string, p: unknown) => void }).__lcxEmit("menu:command", name), command);
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(page.locator(".sidebar")).toBeVisible();

    // The menu bar owns the keys: the same press that opens the palette in a browser does nothing here.
    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette).toHaveCount(0);
    await emit("palette");
    await expect(palette).toBeVisible();
    await emit("palette");
    await expect(palette).toBeHidden();

    await emit("settings");
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
    await expect(page.locator(".settings-nav-item.is-selected")).toBeFocused(); // the focus trap is armed
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);

    await emit("toggle-sidebar");
    await expect(page.locator(".sidebar")).toBeHidden();
    await page.keyboard.press("ControlOrMeta+b");
    await expect(page.locator(".sidebar")).toBeHidden();
    await emit("toggle-sidebar");
    await expect(page.locator(".sidebar")).toBeVisible();
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

  test("the composer toolbar keeps intact labels on one line at every width", async ({ page }) => {
    for (const width of WIDTHS) {
      for (const variant of ["new task", "thread"] as const) {
        await open(page, "", width);
        if (variant === "thread") await openThread(page, "Provider settings refactor");
        const metrics = await page.locator(".composer-bar").evaluate((bar) => {
          const barBox = bar.getBoundingClientRect();
          const visibleChips = [...bar.querySelectorAll<HTMLElement>(".chip")]
            .filter((chip) => chip.offsetParent && chip.getBoundingClientRect().width > 1);
          const labels = [...bar.querySelectorAll<HTMLElement>(".chip-label")]
            .filter((label) => label.offsetWidth > 1);
          return {
            rows: new Set(visibleChips.map((chip) => Math.round(chip.getBoundingClientRect().top))).size,
            wrapped: labels.filter((label) => label.getClientRects().length > 1 || label.scrollHeight > label.clientHeight + 1)
              .map((label) => label.textContent),
            hardClipped: labels.filter((label) => label.scrollWidth > label.clientWidth + 1 && getComputedStyle(label).textOverflow !== "ellipsis")
              .map((label) => label.textContent),
            ellipsized: labels.filter((label) => label.scrollWidth > label.clientWidth + 1)
              .map((label) => label.textContent),
            outside: visibleChips.filter((chip) => {
              const box = chip.getBoundingClientRect();
              return box.left < barBox.left - 1 || box.right > barBox.right + 1;
            }).map((chip) => chip.textContent),
            gap: getComputedStyle(bar).gap,
            overflow: bar.scrollWidth - bar.clientWidth,
          };
        });
        const where = `${variant} @${width}`;
        expect(metrics.rows, `rows ${where}`).toBe(1);
        expect(metrics.wrapped, `wrapped ${where}`).toEqual([]);
        expect(metrics.hardClipped, `hard-clipped ${where}`).toEqual([]);
        expect(metrics.outside, `outside ${where}`).toEqual([]);
        expect(metrics.gap, `gap ${where}`).toBe("4px");
        expect(metrics.overflow, `overflow ${where}`).toBeLessThanOrEqual(1);
        // Above the compact breakpoint every label is whole; at 560 only the model may ellipsize.
        if (width >= 820) expect(metrics.ellipsized, `ellipsized ${where}`).toEqual([]);
        else expect(metrics.ellipsized.every((label) => label?.includes("GPT-5.6")), `ellipsized ${where}`).toBe(true);
      }
    }
  });

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

  // Text rule (docs/design-system.md, Contrast): --fg-3 is the lightest readable text and passes 4.5:1
  // on every surface text sits on; --fg-4 is non-text only and passes 3:1. Ratios are computed from
  // the live custom properties, composited over the window ground, so a reverted token fails here.
  for (const theme of ["dark", "light"] as const) {
    test(`text and non-text contrast hold in the ${theme} theme`, async ({ page }) => {
      await open(page, `theme=${theme}`);
      const rows = await page.evaluate(() => {
        type Rgba = [number, number, number, number];
        const probe = document.createElement("span");
        // A global `transition: color` would make getComputedStyle return the previous colour.
        probe.style.transition = "none";
        document.body.append(probe);
        const read = (value: string): Rgba => {
          probe.style.color = "";
          probe.style.color = value;
          const c = getComputedStyle(probe).color;
          let m = c.match(/rgba?\(([^)]+)\)/);
          if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
          m = c.match(/color\(srgb ([^)]+)\)/);
          if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; }
          throw new Error(`unreadable colour ${c} for ${value}`);
        };
        const root = getComputedStyle(document.documentElement);
        const tok = (name: string) => root.getPropertyValue(name).trim();
        const over = (fg: Rgba, bg: Rgba): Rgba => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1) as Rgba;
        const lum = (c: Rgba) => {
          const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
          return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
        };
        const ratio = (a: Rgba, b: Rgba) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

        // The ground is a gradient; test against both ends of its linear layer and keep the worse ratio.
        const stops = tok("--bg-ground").match(/#[0-9a-f]{6}/gi) ?? [];
        const grounds = stops.slice(-2).map(read);
        const worst = (fg: string, surface: (ground: Rgba) => Rgba) => Math.min(...grounds.map((g) => {
          const bg = surface(g);
          return ratio(over(read(fg), bg), bg);
        }));
        const content = (g: Rgba) => over(read(tok("--surface-content")), g);
        const onContent = (name: string) => (g: Rgba) => over(read(tok(name)), content(g));
        const gradient = (tok("--accent-gradient").match(/#[0-9a-f]{6}/gi) ?? []).map(read);

        const table: [string, number, number][] = [];
        const text = (label: string, color: string, surface: (g: Rgba) => Rgba) => table.push([label, worst(color, surface), 4.5]);
        const nonText = (label: string, color: string, surface: (g: Rgba) => Rgba) => table.push([label, worst(color, surface), 3]);
        for (const [name, surface] of [
          ["content", content], ["card hover", onContent("--surface-card-hover")], ["control", onContent("--surface-control")],
          ["selected row", onContent("--state-selected")], ["float", onContent("--surface-float")],
          ["solid float (drawer, toast)", (g: Rgba) => over(read(tok("--surface-float-solid")), g)],
        ] as const) {
          for (const token of ["--fg", "--fg-2", "--fg-3"]) text(`${token.slice(2)} on ${name}`, tok(token), surface);
        }
        text("syntax comment on a code block", tok("--syntax-comment"), onContent("--surface-code"));
        text("accent-fg on accent-soft", tok("--accent-fg"), onContent("--accent-soft"));
        // Nested fill: an accent badge on the selected row of a menu (selected tint under the badge tint).
        text("accent-fg on accent-soft over a selected row", tok("--accent-fg"), (g) => over(read(tok("--accent-soft")), over(read(tok("--state-selected")), content(g))));
        table.push(["on-warn label on the solid warn fill", Math.min(...grounds.map(() => ratio(read(tok("--on-warn")), read(tok("--warn"))))), 4.5]);
        for (const name of ["ok", "warn", "bad"]) text(`${name} on ${name}-soft`, tok(`--${name}`), onContent(`--${name}-soft`));
        gradient.slice(0, 2).forEach((stop, i) => table.push([`label on gradient stop ${i}`, ratio(read(tok("--fg-on-accent")), stop), 4.5]));
        for (const [name, surface] of [
          ["content", content], ["card hover", onContent("--surface-card-hover")], ["float", onContent("--surface-float")],
        ] as const) nonText(`fg-4 on ${name}`, tok("--fg-4"), surface);
        probe.remove();
        return table;
      });
      const failing = rows.filter(([, got, min]) => got < min).map(([label, got, min]) => `${label}: ${got.toFixed(2)} < ${min}`);
      expect(failing).toEqual([]);
      expect(rows.length).toBeGreaterThan(20);
    });
  }
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
  test("a run that fell back names the model that answered; task cards name their agent", async ({ page }) => {
    await open(page, "", 1180);
    await openThread(page, "Provider settings in tasks");
    await expect(page.getByRole("status").filter({ hasText: "Answered by" })).toHaveText(
      "Answered by deepseek/deepseek-v4: openai/gpt-5.6 was unavailable, so the agent's model list moved on. The next turn starts with openai/gpt-5.6 again.",
    );
    const tasks = page.getByRole("region", { name: "Execution tasks" });
    await expect(tasks.getByLabel("Agent running it: worker")).toHaveCount(5);
    // Another thread's run did not fall back.
    await openThread(page, "Provider settings refactor");
    await expect(page.getByRole("status").filter({ hasText: "Answered by" })).toHaveCount(0);
  });

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


  // ————— Stage A composer: agent, effort, model picker, execution environment —————

  test("the Ask agent's ceiling caps the permission and delegation controls; Agent restores them", async ({ page }) => {
    await open(page, "", 1180);
    await openThread(page, "Provider settings refactor");
    await page.getByRole("button", { name: /^Agent:/ }).click();
    await page.getByRole("menu", { name: "Agent" }).getByRole("menuitemradio", { name: /^Ask/ }).click();
    await expect(page.getByRole("button", { name: /^Agent:/ })).toHaveAccessibleName("Agent: Ask");

    // The chips show what Core will run (min(grant, ceiling)) and say why they cannot change.
    const policy = page.getByRole("button", { name: /^Permissions:/ });
    await expect(policy).toBeDisabled();
    await expect(policy).toHaveAccessibleName("Permissions: Read only");
    await expect(policy).toHaveAttribute("title", /Ask is capped here by its ceiling/);
    const delegation = page.getByRole("button", { name: /^Delegation:/ });
    await expect(delegation).toBeDisabled();
    await expect(delegation).toHaveAccessibleName("Delegation: None");

    // The grant itself was kept: the Agent built-in (no ceiling) offers every level again.
    await page.getByRole("button", { name: /^Agent:/ }).click();
    await page.getByRole("menu", { name: "Agent" }).getByRole("menuitemradio", { name: /^Agent/ }).click();
    await expect(page.getByRole("button", { name: /^Permissions:/ })).toBeEnabled();
    await expect(page.getByRole("button", { name: /^Delegation:/ })).toBeEnabled();
    await page.getByRole("button", { name: /^Permissions:/ }).click();
    await expect(page.getByRole("menu", { name: "Permissions" }).getByRole("menuitemradio")).toHaveCount(3);
    await page.keyboard.press("Escape");
  });

  test("opens Agents from the rail, edits a built-in's instructions and saves", async ({ page }) => {
    await open(page, "", 1180);
    await goToPage(page, /^Agents$/);
    await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();

    await page.getByRole("button", { name: /^Agent( Built-in)?$/ }).click();
    const instructions = page.locator(".agents-instructions");
    await instructions.fill("Lead with the conclusion, then the evidence.");
    await expect(page.getByText("Unsaved")).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Unsaved")).toHaveCount(0);

    // The edit survives a page switch: it went through the bridge, not local component state.
    await goToPage(page, /^Threads/);
    await goToPage(page, /^Agents$/);
    await page.getByRole("button", { name: /^Agent( Built-in)?$/ }).click();
    await expect(page.locator(".agents-instructions")).toHaveValue("Lead with the conclusion, then the evidence.");
  });

  test("creates a read-only custom agent and the composer sends its id with the user's grant", async ({ page }) => {
    await open(page, "", 1180);
    await goToPage(page, /^Agents$/);
    await page.getByRole("button", { name: "New agent" }).click();
    await page.getByLabel("Name").fill("Release reviewer");
    await page.getByRole("button", { name: /^Permission ceiling:/ }).click();
    await page.getByRole("menu", { name: "Permission ceiling" }).getByRole("menuitemradio", { name: /^Read only/ }).click();
    await page.locator(".agents-instructions").fill("Only flag release-blocking risks.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: /^Release reviewer$/ })).toBeVisible();

    // Record what the composer hands the bridge; the stub answers like Core.
    await page.evaluate(() => {
      const app = window.go?.main?.App;
      if (!app) throw new Error("stub bridge is not installed");
      const recorded: { agent?: string; policy?: string; modelRef?: string }[] = [];
      (window as Window & { __lcxAgents?: typeof recorded }).__lcxAgents = recorded;
      const original = app.StartAgent.bind(app);
      app.StartAgent = async (id, cfg) => {
        recorded.push({ agent: cfg.agent, policy: cfg.policy, modelRef: cfg.modelRef });
        return original(id, cfg);
      };
    });

    await goToPage(page, /^Threads/);
    await page.getByRole("button", { name: /^Agent:/ }).click();
    await page.getByRole("menu", { name: "Agent" }).getByRole("menuitemradio", { name: /^Release reviewer/ }).click();
    await expect(page.getByRole("button", { name: /^Permissions:/ })).toBeDisabled();
    await page.getByRole("textbox", { name: /Describe a coding task/ }).fill("Review the release branch");
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => (window as Window & { __lcxAgents?: unknown[] }).__lcxAgents?.length ?? 0)).toBe(1);
    const sent = await page.evaluate(() => (window as Window & { __lcxAgents?: { agent?: string; policy?: string }[] }).__lcxAgents?.[0]);
    // The id is Core's; the policy is the user's grant, which Core caps by the agent's ceiling.
    expect(sent?.agent).toMatch(/^release-reviewer/);
    expect(sent?.policy).toBeTruthy();
  });

  test("the effort picker offers Auto and only the selected model's levels, and disables when fixed", async ({ page }) => {
    await open(page, "", 1180);
    // GPT-5.6 has efforts; the effort chip opens a menu with Default + Auto + its levels.
    await page.getByRole("button", { name: /^Effort:/ }).click();
    const menu = page.getByRole("menu", { name: "Effort" });
    await expect(menu.getByRole("menuitemradio")).toHaveCount(5);
    await menu.getByRole("menuitemradio", { name: "High" }).click();
    await expect(page.getByRole("button", { name: /^Effort:/ })).toHaveAccessibleName("Effort: High");

    // Switch to a model without efforts: the picker shows the not-configurable state.
    await page.getByRole("button", { name: /^Model:/ }).first().click();
    await page.getByRole("textbox", { name: "Search models" }).fill("mini");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: /^Effort:/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: /^Effort:/ })).toHaveAccessibleName("Effort: Effort fixed");
  });

  test("picking Auto is keyboard reachable and sends effort auto to the bridge", async ({ page }) => {
    await open(page, "", 1180);
    await openThread(page, "Improve review diff rendering");

    // Record what the app hands the bridge; the stub still answers as Core would.
    await page.evaluate(() => {
      const app = window.go?.main?.App;
      if (!app) throw new Error("stub bridge is not installed");
      const recorded: { effort?: string }[] = [];
      (window as Window & { __lcxEfforts?: { effort?: string }[] }).__lcxEfforts = recorded;
      const original = app.ContinueAgent.bind(app);
      app.ContinueAgent = async (id, content, cfg) => {
        recorded.push({ effort: cfg.effort });
        return original(id, content, cfg);
      };
    });

    // Auto is the first selectable row after Default, with its heuristic note.
    const chip = page.getByRole("button", { name: /^Effort:/ });
    await chip.click();
    const menu = page.getByRole("menu", { name: "Effort" });
    await expect(menu.getByRole("menuitemradio")).toHaveCount(5);
    const auto = menu.getByRole("menuitemradio", { name: /^Auto/ });
    await expect(auto).toContainText("heuristic rules unless effort.auto.model");
    await page.keyboard.press("Escape");

    // Keyboard: opening focuses the checked row (Default), ArrowDown walks to Auto, Enter picks.
    await chip.click();
    await expect(menu.getByRole("menuitemradio").first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(chip).toHaveAccessibleName("Effort: Auto");

    await page.getByRole("textbox", { name: "Start another task" }).fill("judge this turn");
    await page.getByRole("button", { name: "Resume" }).click();
    const sent = await page.evaluate(() => (window as Window & { __lcxEfforts?: { effort?: string }[] }).__lcxEfforts ?? []);
    expect(sent.at(-1)?.effort).toBe("auto");
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

  test("the environment is configured on the new-task strip and read-only in a thread", async ({ page }) => {
    await open(page, "", 1180);
    // New task: the project is a read-only label in the strip, never a toolbar chip.
    const strip = page.locator(".composer-env");
    await expect(strip).toBeVisible();
    await expect(strip.locator(".env-project")).toContainText("lumencortex");
    await expect(strip.locator(".env-project")).toHaveAttribute("title", "/Users/demo/Projects/lumencortex");
    await expect(page.locator(".composer-bar").getByRole("button", { name: "lumencortex" })).toHaveCount(0);
    await expect(strip.locator(".env-target")).toContainText("Local");

    // Full access is the one permission that carries the warning colour.
    await page.getByRole("button", { name: /^Permissions:/ }).click();
    await page.getByRole("menu", { name: "Permissions" }).getByRole("menuitemradio", { name: /^Full access/ }).click();
    await expect(page.locator(".composer-policy")).toHaveClass(/is-full/);

    // Keyboard only: ArrowDown on the chip opens the menu on the checked option, Up + Enter picks,
    // and focus is back on the chip.
    const chip = page.getByRole("button", { name: /^Permissions:/ });
    await chip.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitemradio", { name: /^Full access/ })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(page.locator(".composer-policy")).not.toHaveClass(/is-full/);
    await expect(chip).toBeFocused();

    // The gear opens the environment popover: New worktree is the Local/Worktree switch.
    const gear = page.getByRole("button", { name: "Configure environment" });
    await gear.click();
    const popover = page.getByRole("dialog", { name: "Configure environment" });
    const toggle = popover.getByRole("switch", { name: "New worktree" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(popover.locator(".env-setting-value")).toHaveText("HEAD");
    await expect(popover.locator(".env-setting-value")).toHaveAttribute("title", /stays HEAD/);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(strip.locator(".env-target")).toContainText("Worktree");
    await page.keyboard.press("Escape");
    await expect(gear).toBeFocused();

    // An existing conversation shows the session's runtime identity in the same strip, read-only.
    await openThread(page, "Provider settings refactor");
    await expect(page.locator(".composer-env .runtime-identity")).toBeVisible();
    await expect(page.locator(".composer-env .runtime-identity")).toContainText("Worktree");
    await expect(page.locator(".composer-env .runtime-identity")).toContainText("lumencortex/demo");
    await expect(page.getByRole("button", { name: "Configure environment" })).toHaveCount(0);
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
  await expect(page.getByText("Reads environment variable DEEPSEEK_API_KEY (not set)")).toBeVisible();
}

test.describe("provider pane: protocol and direct-input API keys", () => {
  test("keeps the new controls unclipped at every window width", async ({ page }) => {
    for (const width of WIDTHS) {
      await open(page, "", width);
      await openThread(page, "Provider settings refactor");
      await openProviderPane(page);

      const pane = page.getByRole("dialog", { name: "Settings" });
      // ONE API key field shows the env reference as visible text; no source radio group.
      await expect(pane.getByRole("radiogroup", { name: "Source" })).toHaveCount(0);
      await expect(pane.getByRole("textbox", { name: "API key" })).toHaveValue("$" + "{DEEPSEEK_API_KEY}");
      await pane.getByRole("button", { name: "Edit" }).first().click();
      await expect(pane.getByRole("radiogroup", { name: "Protocol" })).toBeVisible();
      await expect(pane.getByRole("radio", { name: "Anthropic Messages" })).toBeVisible();

      expect(await clippedControls(page)).toEqual([]);
      expect(await hardClippedText(page)).toEqual([]);
      await page.keyboard.press("Escape");
    }
  });

  test("side-by-side fields share one height: text input and select trigger", async ({ page }) => {
    await open(page, "", 1440);
    await openThread(page, "Provider settings refactor");
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.type("Settings");
    await page.keyboard.press("Enter");
    const pane = page.getByRole("dialog", { name: "Settings" });
    await pane.getByRole("button", { name: /MCP servers/ }).click();
    await pane.getByRole("button", { name: "Add server" }).first().click();
    const heights = await pane.evaluate((root) => {
      const h = (el: Element) => Math.round(el.getBoundingClientRect().height);
      const fields = [...root.querySelectorAll(".extensions-editor input.input")].map(h);
      const selects = [...root.querySelectorAll(".extensions-editor .desktop-select-trigger")].map(h);
      return { fields, selects, token: parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ctl-field")) };
    });
    expect(heights.fields.length).toBeGreaterThan(0);
    expect(heights.selects.length).toBeGreaterThan(0);
    expect([...new Set([...heights.fields, ...heights.selects])]).toEqual([heights.token]);
  });

  test("single key field: placeholder input, literal storage, remove, and no leaks", async ({ page }) => {
    await open(page, "", 1180);
    await openThread(page, "Provider settings refactor");
    await openProviderPane(page);
    const pane = page.getByRole("dialog", { name: "Settings" });
    const field = pane.getByRole("textbox", { name: "API key" });

    // A literal goes through masked; the value leaves with the save call.
    await field.fill("sk-stub-NEVER-PRINT-2468");
    await pane.getByRole("button", { name: "Save" }).click();
    await expect(pane.getByText("Saved locally")).toBeVisible();
    await expect(page.locator(".lc-window")).not.toContainText("sk-stub-NEVER-PRINT-2468");
    await expect(field).toHaveValue("");
    await expect(field).toHaveAttribute("placeholder", "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022");

    // Replace with an environment placeholder: visible plain text, env status adopted.
    await field.fill("$" + "{MY_PROVIDER_KEY}");
    await pane.getByRole("button", { name: "Replace" }).click();
    await expect(pane.getByText("Reads environment variable MY_PROVIDER_KEY (not set)")).toBeVisible();
    await expect(field).toHaveValue("$" + "{MY_PROVIDER_KEY}");

    // With an env reference configured there is no stored key to remove, so no Remove
    // button exists (backend leaves env references alone). Store a literal again to remove it.
    await expect(pane.getByRole("button", { name: "Remove" })).toHaveCount(0);
    await field.fill("sk-stub-NEVER-PRINT-2468");
    await pane.getByRole("button", { name: "Save" }).click();
    await expect(pane.getByText("Saved locally")).toBeVisible();
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
