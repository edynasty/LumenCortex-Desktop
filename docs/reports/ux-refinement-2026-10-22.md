# UX refinement - 2026-10-22

Status: **implemented, final-reviewed and validated locally; not pushed.** Branch `main`, baseline `2830d20`, refinement head `8b13d49`, final-review head `c5f40c9` (see "Final review and remediation").
Plan and audit: `../LumenCortex-Desktop-UX-Refinement/docs/design/ux-refinement/` (README, audit, review, plan, demo).
Scope: the 11 plan steps and the two independent review gates. No Core change; Core pin unchanged (`3e4f418`, `go.mod`).

## Commits

| Step | Commit | Change |
|---|---|---|
| 1 | `c0f575b` | `--fg-3` is the lightest readable text (>= 4.5:1 on every surface), `--fg-4` non-text only; darker light semantic colours and accent gradient; Playwright test computes ratios from live tokens, both themes |
| 2 | `150588d` | motion contract per `motion-design.md`; window-level z-index tokens; dead rules and unused tokens removed |
| G1 | in `fe75abf` | review corrections (`--on-warn`, light `--accent-fg`, wider contrast coverage) |
| 3 | `fe75abf` | Dialog, Drawer and error toast play a 120 ms exit (`usePresence`: inert, click-through, focus returns at dismissal, reopen cancels) |
| 4 | `0069649` | MenuPicker focuses the checked option on open; ArrowDown/Up opens from the chip; attach items are a `role=menu` |
| 5 | `a33acb6` | the A1 turn is the one running glyph, always with a label; shimmer, spinner and sliding bar removed; one polite live region announces run start, gate and end |
| 6 | `ca90071` | native macOS menu bar owned by Go (one event per command, webview keys stand down); native window background follows the theme |
| 7 | `b8fadef` | Source Control state cell shows a loading state until the change count is read |
| 8 | `6d85534` | drawer and toast use `--surface-float-solid` (no blur); chrome `user-select: none`, content selectable; overscroll contained; `prefers-contrast: more` block |
| 10 | `1c531d9` | negative letter-spacing removed from five title styles |
| G2 fix | `699e249` | each run announcement is its own occurrence (identical text from same-titled threads is spoken again, own 4 s clear window) |
| 11 | `5456ada` | diff lines scroll instead of ellipsizing; `title` carries the full value on truncated paths, tool targets, context rows, commit messages |
| 9 | `8b13d49` | semantic `--r-card` 10, `--r-inset` 6, `--ctl-field` 30, `--ctl-icon` 26 / `--ctl-icon-lg` 30 applied; review inputs use the inset-ring edge; `--ctl-lg` removed |

## Review gates

- **G1** (after step 2): corrections applied in `fe75abf`.
- **G2** (after step 6, reviewer agent, read-only): verdict ACCEPT WITH CHANGES. One P2 - repeated identical announcement text was not re-spoken and a stale timer cleared the second occurrence early. Fixed in `699e249` with a fake-timer regression test (`useRunAnnouncement.test.tsx`). No P0/P1.
  The reviewer ran no builds or native checks (committed snapshots only through `ca90071`); steps 7-11 had no independent review beyond this report's own checks.

## Validation (run at head `8b13d49`; superseded by the final review below)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 65 files, 313 tests passed |
| `npx playwright test` (visual harness; layout checks at 1568/1440/1180/820/560, both themes, both locales) | 83 passed |
| `npm run build` | built |
| `go vet ./...` | clean |
| `go test ./internal/backend .` | ok |
| `scripts/build-macos.sh` | OK, arm64 bundle, ad-hoc re-signed |

New or extended tests: contrast incl. solid float surface; material (drawer filter none, at most two blurred layers, chrome vs content `user-select`, `overscroll-behavior`, non-negative title tracking); 300-column diff line scrolls in unified and split views; field-height geometry (MCP editor input and select equal `--ctl-field`); run-announcement occurrence test.

## Native evidence

Packaged `LumenCortex Desktop.app` launched; menu bar read through System Events: `LumenCortex Desktop | 文件 | Edit | 视图 | Window` (Chinese system locale). File > 关闭窗口 clicked via AX; the process exited (same quit path as the red button). Earlier in the milestone the full native menu contents (About, Settings, New Thread, Close Window, Command Palette, Toggle Sidebar) were read the same way.

## Unverified / limits

- No native screenshots: Screen Recording is denied for the agent, `screencapture` fails, and AX reports 0 windows for the process. Native visual checks (blur absence on a real drawer, `prefers-contrast: more` with macOS Increase Contrast, window background at launch, resize) remain the owner's G2 acceptance check.
- `prefers-contrast: more` is verified only as CSS; WKWebView support is documented but the native effect was not observed.
- Steps 7-11 changed CSS and small TSX only; they are covered by the harness, not by a second reviewer.
- `docs/design-system.md` section 5 raw radius/control tables are older nominal values; the new "Semantic shape tokens" subsection is the contract. Rewriting the raw tables was out of scope.
- Working tree carries pre-existing untracked/modified build artefacts (`go.sum`, `build/darwin/Info*.plist`, `frontend/package.json.md5`, `frontend/wailsjs/`, `LumenCortex-Desktop` binary, `frontend/dist/.keep` deletion, `frontend/test-results/`); none were staged.

## Next

Owner native acceptance walk-through at 1440/1180/820/560, light and dark, with Increase Contrast on and off; then push decision.

## Final review and remediation (2026-10-22)

Scope: all production changes `c0f575b..8b13d49`, with priority on steps 7-11, by three independent
read-only reviewers (polish steps 7-11, foundation steps 1-6, documentation) plus my own pass, and
WebKit (Playwright WebKit 26.6, the WKWebView engine) renders in both themes at 1440/1180/820/560.

### Defects found and fixed

| Sev | Defect | Fix | Regression test |
|---|---|---|---|
| P1 | Step 8: the global `* { overscroll-behavior: contain }` stopped the mouse wheel over a code block (or short tool output) from scrolling the thread, in WebKit and Chromium | `7b836af`: `html, body { overscroll-behavior: none }`; `contain` only on pane scrollers; nested content scrollers keep the default | "the wheel over a code block that only scrolls sideways still scrolls the thread" (fails with the old rule: scrollTop stays 0) |
| P2 | Step 8: `prefers-contrast: more` had no effect: `:root` lost on specificity to `:root[data-theme=...]` | `0e69bac`: the block targets `:root, :root[data-theme]` | "Increase Contrast makes content and float surfaces solid in both themes" (fails before: `rgba(255,255,255,0.80)` instead of `#ffffff`) |
| P2 | Step 8: the worktree popover's branch and path could not be selected, because the popover renders inside `.toolbar` and inherited `user-select: none` | `7b836af`: popover content opts back into `user-select: text`, its buttons stay `none` | "a branch or path in a toolbar popover can be selected" (fails before: empty selection) |
| P2 | Step 7: if Core's git status read failed, the Source Control state cell said "Loading" forever | `da52371`: a failed read sets the count to `null` and the cell shows "Unknown"; the error toast still reports it | `ScmCheckoutView.test.tsx`, `useSourceControlPage.test.tsx` (rejected `gitStatus`) |
| P3 | Step 1: light `--fg-3` fell to 3.98:1 on the sidebar's selected row and 4.18:1 on the search field. These sit on the bare ground under the radial light, and the contrast test did not cover them | `3b475ef`: light `--fg-3` `#505b72` (4.55 / 4.76 at the worst point); the test composites the ground's radial lights and adds ground, selected-row-on-ground and sunken-field surfaces | extended "text and non-text contrast hold" |
| - | `go.sum` modified in the working tree | `d70455f`: it was `go mod tidy` output (the Wails build tidies), dropping hashes of superseded Core pins; `go mod verify` and a `-mod=readonly` build pass, and a fresh native build leaves it clean | - |
| docs | `design-system.md` sections 2, 5, 6, 7, 8, 9, 10 and 11 described a pre-Lumen-Glass palette, radii 12/16, control heights 28/32/36 and nine shadow/backdrop tokens that do not exist. `motion-design.md` listed durations that differ from the CSS (inspector, popover, new message) and four rows with no implementation, and said loading dots hide under reduced motion (they are static). `architecture.md` said every custom item emits (Close Window does not). This report named the wrong Core pin and "4 widths" for five | `c5f40c9` and this update | - |

### Reviewed, no defect

Token integrity: a script diffed used against defined custom properties; no dangling references, and the
only unused tokens predate this work. `usePresence` exits on a timer from `--dur-fast`, not on
`animationend`, and has no leak on reopen or unmount. The run announcement's zero-width space only
reaches the `sr-only` live region, and a workspace switch cannot produce a false announcement. The Edit
menu has the native undo/redo/cut/copy/paste/select-all actions, and accelerators do not collide. Every
text input and textarea is selectable. Field and adjacent-button heights hold at 560 and 1440, light and
dark. No title tracking is negative and no CJK title is clipped. Step 11's titles and diff scrolling were
also checked.

### Validation at `3b475ef` (code); `c5f40c9` changes docs only

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 65 files, 315 tests passed |
| `npx playwright test` (Chromium) | 86 passed |
| Playwright WebKit throwaway run (renders + computed material checks) | 14 passed; screenshots reviewed |
| `go vet ./...`, `go test ./internal/backend .` | ok |
| `go mod verify`, `go build -mod=readonly ./...` | ok |
| `scripts/build-macos.sh` | OK, arm64; the bundle contains the fixed CSS (`#505b72` found in the binary); `go.sum` stays clean |

### Native evidence (packaged app, rebuilt at `3b475ef`)

- Menu bar read via System Events: `LumenCortex Desktop | 文件 | Edit | 视图 | Window`. The App menu holds About, Hide, Hide Others, Show All and Quit. 文件 holds 新建会话, 设置… and 关闭窗口. 关闭窗口 quits the app.
- Window resized via AX to 1440/1180/820/560. The toolbar stays on one row inside the window at every width. The rail is docked down to 820 and leaves the window at 560 (compact), matching the breakpoint contract.
- A real double-click on the title bar, posted as CGEvent mouse events, zooms the window from 1180×800 to 1800×1130, and a second double-click restores 1180×800.

### Still owner-only (no pixel access)

Screen Recording is denied to this agent, so native pixels cannot be captured. These need the owner's
eyes in the packaged app:
- the solid drawer and the error toast at 820/560;
- the window background at launch in both themes;
- light `--fg-3` `#505b72` (a slightly darker tertiary grey);
- macOS Increase Contrast (verified in WebKit emulation only).

### Known limits, not fixed

- Split diff view: both halves take the width of the longest line on either side. With a 300-column line,
  the right half starts about 2.4k px to the right at 1440, so the reader scrolls to reach it. This is
  still an improvement: before step 11 the split view could not scroll at all. Per-half scrolling or
  wrapping is a design decision for the owner.
- The App, Edit and Window menus have English titles and items in Chinese, and Settings… lives in File
  rather than the App menu. Wails v2.16 hardcodes these role menus, and custom items cannot carry native
  editing actions. Changing this needs a Wails upgrade or a native menu bridge, which is out of scope.

Release readiness: ready for the owner's native visual acceptance. All found defects are fixed and covered by tests; no open P0-P2.

