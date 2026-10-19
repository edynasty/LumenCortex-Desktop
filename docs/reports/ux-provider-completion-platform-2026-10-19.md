# UX & Provider Completion — Platform Stage A (items 1–3) + native verification

Date: 2026-10-19
Scope: Desktop repo. Items 1–3 of Stage A: native title-bar double-click zoom honoring `AppleActionOnDoubleClick`, A1 application icon replacing the obsolete 'W', project switcher menu. Plus the deferred native-app verification of the composer (commit a158829, items 4–8) on the same build. Written incrementally by PlatformFinish after two interrupted runs (DesktopPlatform, DesktopPlatform2 — upstream 502s); their finished work was verified and completed, not redone.

## Root cause: title-bar double-click (item 1)

Read from the Wails v2.16 source in the Go module cache:

- `internal/frontend/runtime/desktop/main.js` (drag handling): `dragTest` only forwards a mousedown when `e.detail === 1` — **the second click of a double click is dropped by design**, so with `mac.TitleBarHiddenInset()` (title bar is web content) no zoom ever happens.
- `internal/frontend/desktop/darwin/WailsContext.m`: the native side only implements the `"drag"` message → `performWindowDragWithEvent:`; nothing anywhere calls `zoom:`/`performZoom:` or consults the system double-click action.
- `options.Mac` (v2.16) has no option for it.

Fix (frontend reports, native acts): `frontend/src/lib/titlebar.ts` listens for `dblclick` and forwards only clicks whose target resolves `--wails-draggable: drag` (the same test Wails' own `dragTest` uses — the custom property inherits, interactive controls keep their `no-drag` override and their normal double click). The Go side (`titlebar.go`, `App.TitleBarDoubleClick`) reads the live `AppleActionOnDoubleClick` global preference (`defaults read -g`, once per double click, no cgo) and performs **Minimize**/**Maximize**/**None** exactly like a native title bar; in fullscreen it is a no-op (a hidden-inset title bar is not a zoom target). Bridge method `TitleBarDoubleClick` is declared in `frontend/src/lib/bridge.ts` (`AppAPI` + `bridge.titleBarDoubleClick`), cross-checked by `TestBridgeDeclaresExactlyTheBoundAppMethods` in `app_test.go`; wailsjs bindings regenerate on build. Installed from `main.tsx` on native macOS only.

## Root cause: the shipped icon (item 2)

`wails build` (v2.16 `pkg/commands/build/packager.go`) writes `Contents/Resources/iconfile.icns` itself by **nearest-neighbour** resampling of the single 1024 px `build/appicon.png` (`jackmordaunt/icns` `Encode`, interpolation.go: `NearestNeighbor`). The repo had no icon assets committed at all, so the bundle shipped Wails' embedded default template icon — the big 'W'. Fix: committed A1 masters (`build/appicon.svg` glass for ≥256 px, `build/appicon-small.svg` flat high-contrast for ≤128 px, both on the 824 px / r185 icon-grid squircle), `scripts/generate-app-icon.mjs` renders the full iconset with the same Chromium the visual tests use and packs it with `iconutil`, and `scripts/build-macos.sh` now installs `build/darwin/iconfile.icns` over the Wails-resampled one post-build and re-signs the bundle (replacing resources invalidates the ad-hoc signature).

## Project switcher menu (item 3)

New `components/sidebar/ProjectMenu.tsx` replaces the `AnchoredPopover` variant (which was absolutely positioned inside the sidebar frame — clipped by its `overflow: hidden`, width bound to the trigger, paths truncated silently):

- Portaled to `document.body`, positioned against the trigger's live rect, flips above and shifts to stay inside the window at every width (1440/1180/820/560); re-measured on scroll/resize. Placement is written imperatively in one `useLayoutEffect` (no "hidden until placed" state — that made rows unfocusable in the same commit because Chromium focusability uses the last style recalc).
- Width follows content (min 280 px, capped near half the window), not the trigger. Complete names wrap; full paths middle-ellipsize via `PathLabel` with the full text in the row's hover `title`.
- Keyboard: open with Enter/Space (click path) or ArrowDown/ArrowUp on the trigger; ArrowUp/Down/Home/End walk rows, ArrowRight reaches a row's copy action, Enter selects, **Esc closes and restores focus to the trigger** (consumed + propagation stopped, so at 820/560 the sidebar drawer's focus trap does not also close — one Esc closes one layer), Tab closes and moves on. Roving tabindex over `role="menuitemradio"` selects + `role="menuitem"` copy actions; `role="menu"` + `aria-label`.
- Per-project copy-path via `frontend/src/lib/clipboard.ts`, visible + `aria-live` confirmation (checkmark + "Path copied" for 1.6 s).

## Verification (commands and observed results)

| Check | Command | Result |
|---|---|---|
| Types | `cd frontend && npx tsc --noEmit` | 0 errors |
| Unit tests | `cd frontend && npx vitest run` | **47 files / 204 tests passed** (new `ProjectMenu.test.tsx`: Enter-open + focus current project; arrows/Home/End roving; Enter selects + closes + focus restore; Esc/Tab close semantics; copy-path with accessible confirmation) |
| Playwright | `cd frontend && npx playwright test` | **58 passed** (new: project switcher menu stays inside the window at 1440/1180/820/560 — trigger found in the docked sidebar or opened from the drawer below 880 px, menu box asserted inside the viewport, `.project-name` complete, Esc closes) |
| Frontend build | `cd frontend && npm run build` | built in 1.73 s, no warnings |
| Go vet | `go vet . ./internal/backend` | clean |
| Go tests | `go test -timeout 90s -count=1 . ./internal/backend` | **ok** both packages (the `mode` DTO failure seen by DesktopPlatform2 was the composer's mid-edit state, fixed in a158829) |
| macOS bundle | `scripts/build-macos.sh` | OK — `build/bin/LumenCortex Desktop.app`, arm64, bundle verified, icon `iconfile.icns` byte-identical to `build/darwin/iconfile.icns` |

## Native verification on the launched bundle

Isolated launch: `XDG_CONFIG_HOME=/tmp/lcx-iso/config build/bin/LumenCortex Desktop.app/Contents/MacOS/LumenCortex` with a temp global config (providers Alpha Cloud: `Alpha Fast` with efforts low/medium/high and `Alpha Plain` without, key env unset; Beta Local: `Beta Coder`, no key needed). The picker project was an existing scratch workspace (`/private/tmp/c3-e2e/ws2`); no owner data was written. Input was synthesized with a small Swift CGEvent poster (`mouseEventClickState` 1/2) and System Events/AX; this process holds Accessibility and post-event rights but **not Screen Recording** (`screencapture`: "could not create image from display"), so evidence is AX-tree/bounds readings, not screenshots.

| Step | Observation |
|---|---|
| Window before (second display, not maximized) | position 2040,-46 size 1440x900 |
| Real double-click on the toolbar (2 CGEvents, clickState 1→2) | 1800,-68 size 1920x985 (zoomed to the display's usable area) |
| Second double-click | 2040,-46 size 1440x900 (restored) |
| Real press-drag of -100,+60 from the toolbar | position 1940,14 (window moved by exactly the drag vector) |
| AX `AXFullScreen=true` / double-click while fullscreen / `false` | fullscreen 1920x1080; double-click no-op in fullscreen; exit restored 1440x900 |
| Traffic lights | AX shows close / minimize / zoom(full screen) buttons at 1958,32 / 1981,32 / 2004,32 (native, unchanged) |
| Icon | `Contents/Resources/iconfile.icns` equals `build/darwin/iconfile.icns`; renders in `docs/reports/ux-provider-completion/appicon-{16,32,128,512}.png`; no 'W' asset left (`CFBundleIconFile=iconfile`) |

Caveat: an earlier attempt failed only because the app was not the frontmost application (events landed elsewhere); after activating it all three gestures worked.

### Composer (commit a158829) on the real bundle

AX tree of the new-task screen: toolbar left `模式: 代理`, `权限: 工作区`, `上下文`, project chip; right `模型: Alpha Fast`, `推理强度: 默认`, `开始`; below the card the row `运行环境: 本地` with `创建会话后不可更改`. ⌘⇧M opened the model picker (`搜索模型` field + list grouped `Alpha Cloud` / `Beta Local`; Alpha rows labelled `缺少密钥 … 未设置 API Key`, disabled). Typing `coder` left only `Beta Coder`; Enter selected it and the effort chip became `推理强度: 强度不可调` (model without efforts). Not exercised natively: sending a turn (no reachable provider), Ask-mode turn against Core (covered by the Go test `agent_mode_test.go`).


## Files

- `titlebar.go`, `titlebar_test.go` — `App.TitleBarDoubleClick` + preference mapping
- `frontend/src/lib/titlebar.ts`, `frontend/src/main.tsx`, `frontend/src/lib/bridge.ts` — frontend wiring
- `frontend/src/components/sidebar/ProjectMenu.tsx` + `.test.tsx`, `Sidebar.tsx`, `sidebar.css`, `app-shell/shell.css` — project switcher
- `frontend/src/lib/i18n/app-copy.ts` — `projectMenu`/`copyPath`/`copiedPath`/`copyFailed` (zh + en)
- `frontend/visual-tests/app.spec.ts` — geometry case
- `build/appicon.svg`, `build/appicon-small.svg`, `build/appicon.png`, `build/darwin/iconfile.icns` — A1 icon assets
- `scripts/generate-app-icon.mjs`, `scripts/build-macos.sh` — generation + post-build install
