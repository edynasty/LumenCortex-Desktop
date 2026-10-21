# UX refinement - 2026-10-22

Status: **implemented and validated locally; not pushed.** Branch `main`, baseline `2830d20`, head `8b13d49`.
Plan and audit: `../LumenCortex-Desktop-UX-Refinement/docs/design/ux-refinement/` (README, audit, review, plan, demo).
Scope: the 11 plan steps and the two independent review gates. No Core change; Core pin unchanged (`aa12861`).

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

## Validation (run at head `8b13d49`)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 65 files, 313 tests passed |
| `npx playwright test` (visual harness, 4 widths 1568/1440/1180/820/560 layout checks, both themes, both locales) | 83 passed |
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
