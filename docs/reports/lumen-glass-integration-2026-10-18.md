# Lumen Glass production UI integration (2026-10-18 → 2026-10-19)

Status: **implemented and validated** in the browser harness and the native macOS app (accessibility
tree). Local commits only, nothing pushed. Two owner decisions remain open (see the last section).

## Scope and baseline

- Production Desktop `main`, starting at `d2d9ff4` (build-repair commit). The build-repair work's
  untracked outputs (`LumenCortex-Desktop`, `build/`, `frontend/wailsjs/`, `frontend/test-results/`,
  `frontend/package.json.md5`) and its `frontend/dist/.keep` deletion were never touched or staged.
- Visual reference: UI Demo `design/ui-demo` at `aca4b88`
  (`docs/design/Lumen-Glass-Reference/approved-design-reference.png`, `frontend/src/demo/`,
  `docs/reports/lumen-glass-final-2026-10-16.md`). The Demo was not modified.
- Core pin unchanged (`aa12861`). No Core or backend Go changes; `main.go` changes only the title bar
  style (Stage A).

## Commits

| Commit | Content |
|---|---|
| `0dd0bd7` | Stage A: tokens, base elements, window shell (toolbar, rail, resizable sidebar/inspector, drawers), threads sidebar, settings sheet, command palette, welcome, A1 brand, hidden-inset native title bar, visual harness over a stubbed bridge |
| `73ac2ba` | Split the legacy `styles.css` into thread / inspector / runtime-identity / toast stylesheets; dead pre-shell selectors removed |
| _see final section_ | Stages B–D (UI) and this report with screenshots |
| `c3d8bb6` | Stages B–D: conversation, composer, task cards, inspector, Source Control, Context, settings panes, Stage D fixes, Playwright rewrite |
| _this report's commit_ | Report, screenshots, app icon candidate |
## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Port Demo tokens (`styles/tokens.css`), base elements (`styles/base.css`) and shell geometry (`components/app-shell/shell.css`) verbatim, then adapt; delete `styles/global.css`. | One token source. The Demo values are the approved design. |
| D2 | A temporary alias block mapped old token names onto the new ones during the cutover. **Removed** once every stylesheet had migrated. | Kept unmigrated surfaces in the new palette during the cutover, with no permanent second vocabulary. |
| D3 | Native traffic lights stay native (Wails `TitleBarHiddenInset`). The Demo's simulated `.traffic-lights` are not ported. `html[data-chrome="mac-inset"]` reserves their space in the toolbar lead. | No duplicate window chrome; native drag and zoom keep working. |
| D4 | Drag regions use `--wails-draggable: drag/no-drag`. | That is the property Wails v2 reads. |
| D5 | Routes: `new-task`, `thread`, `review` (thread Changes view), `scm` (checkout = `main` or a session id), `context`. Providers and Extensions are panes of the Settings sheet, not routes. | Matches the Demo rail (Threads / Context / Source Control + Settings). |
| D6 | Pane geometry persists as one `lcx-layout` UI preference. | UI preference only, no session state. |
| D7 | Icons go through one concept map (`components/primitives/icons.ts` + `Icon.tsx`, Lucide only). | Demo rule: one glyph per concept. |
| D8 | Context shows only relations Core data supports (see Context). | No fabricated graph data (prompt §7). |
| D9 | Breakpoints follow the Demo: the inspector docks at ≥1240 px and is a drawer below that (so at 1180 it is a drawer with a scrim); the rail moves into the sidebar drawer below 640 px. | Same behaviour as the approved Demo at each validation width. |
| D10 | Narrow composers (container < 600 px) shrink secondary chips (context, project, permission, delegation, environment) to their icon. The label stays in the accessibility tree and the hover title. The model chip keeps its label. | At 560 px every chip was cut to 1–3 characters. The model choice is the one users need to read. |
| D11 | The visual harness renders the real `App` over an in-memory bridge (`visual/app-stub.ts`, `visual/fixture-data.ts`, `visual/task-fixture.ts`), loaded only by `visual.html`. | Screenshots and Playwright exercise production components. The fixture code is not in the `index.html` bundle. |

## What was migrated

- **Shell (Stage A):** toolbar, rail, sidebar + project switcher, resizable panes, drawers, Settings
  sheet (general, models and providers, permissions, MCP, skills, trust, about), command palette (⌘K),
  welcome screen, A1 brand mark.
- **Conversation (B):** transcript blocks (`thread.css`), `WorkGroup` tool-run grouping (replaces
  `ToolCard`), `ThreadOutcome`, approval/gate and failure blocks, execution task cards (proposal /
  running / interrupted / result), thread and new-task composers with shared `ComposerPickers`
  (model search picker, menu pickers as `role="menu"` / `menuitemradio`).
- **Inspector (B):** `WindowPane`/`Section` frame; Task State, checks (artifacts, accept), runtime and
  context window, subagent tree, milestones, LSP/run settings restyled to the Demo panes.
- **Source Control (C):** new `components/scm/`: project checkout view with branch graph, session
  worktree views (ownership, lifecycle, apply via the existing handoff plan, cleanup through the
  existing `WorktreeCleanupDialog`), changes view. Data comes only from `bridge.gitStatus` and
  `bridge.inspectSessionWorktree`.
- **Review (C):** diff viewer restyled; the unified/split toggle is hidden below the compact breakpoint.
- **Context (C):** new `components/context/` (see the next section).
- **Settings panes (B):** provider catalog, forms, MCP, skills and tool permissions moved onto the
  sheet's pane styles.

### Context page: supported subset

Data: workspace sessions plus each thread's Task State (`bridge.taskState`). At most 30 recent
non-archived threads are loaded, lazily, and loading is cancelled when the page closes. The graph draws
at most 60 files.

| Demo relation | Production |
|---|---|
| thread → file | Task State `path` references: included (solid) or suggested (dashed). Excluded references are never drawn. |
| thread → thread | Task State `thread` references, plus Core's subagent parent/child link |
| notes, citations, typed note links, blob freshness | **Not drawn.** Core has no note records yet. The page says so. |

## Stage D: problems found in rendered output and fixed

All found by inspecting the screenshot matrix, not by tests.

| Width / scene | Defect | Fix |
|---|---|---|
| 560, new thread and thread | Every composer chip cut to 1–3 characters | D10 icon-only chips (`composer.css`, `ComposerPickers`, `ThreadComposer`, `DelegationControl`, `ContextAttachments`) |
| 560, new thread | Config warning touched the window edges | Width set with `calc()` gutters (`new-task-composer.css`) |
| all, task cards | Kicker repeated the plural "Execution tasks" on every card; a spacer took half the title's width | Per-card kicker ("Execution task" / "Proposed task", as in the Demo); spacer removed |
| all, Changes | `diff --git` / `index` / `---` / `+++` header rows rendered as diff lines | `parseUnifiedDiff` drops the file header and keeps hunk headers and `\ No newline`. Inside a hunk, the first column alone decides the line kind, so a deleted `-- comment` line counts as a deletion (previously misread as a header) |
| 820 / 1180, Context graph | File nodes clipped (`…bac`) beside the detail pane | Stacking now depends on the page's own width through a `context-page` container query (≤ 900 px) instead of the window width. The graph lens selector's specificity also overrode the stack rule. |
| approval | Plan card showed the raw Core enum `waiting_gate` | Removed: the localized state chip already conveys it (`ThreadProgress`) |
| approval | No Approve action in the harness | The harness fixture used gate type `approval`; Core only has `condition` / `human` (`internal/workflow/definition.go:162`). Fixed the fixture; the production filter was already correct. |
| 560, settings | Provider list and editor ran past the sheet's right edge | Narrow `provider-layout` column `1fr` → `minmax(0, 1fr)`; long config path wraps |
| 560, Source Control | Picking a worktree left the drawer covering the result | Choosing a checkout closes the compact drawer, as choosing a thread already did (`useWorkspacePages`) |

Regression tests added for behaviour, not CSS values:
- `components/review/diff.test.ts`: header dropped; `--`/`++` lines inside a hunk are changes. Both fail
  on the old parser.
- `visual-tests/app.spec.ts`: a human gate offers Approve and the card disappears once Core clears the
  gate; picking a worktree from the compact drawer closes it and shows that worktree (fails without the
  fix).

## Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 44 files, 179 tests passed |
| `npx playwright test` (`visual-tests/app.spec.ts`, real App over the stub bridge) | 52 passed: shell, layout at 1440/1180/820/560 (no clipped controls or text, toolbar on one line), accessibility, Core-backed interactions (proposal start / subtree Stop, delegation grant, check accept, model picker at 4 widths, gate approval, compact split diff, compact drawer) |
| `npm run build` | OK |
| `go test -timeout 90s ./internal/backend` | ok (12.8 s) |
| `go vet . ./internal/backend` | OK |
| `scripts/build-macos.sh` | OK; bundle verified, arm64 |

### Screenshots

`docs/reports/lumen-glass-integration/` holds 22 captures: `<scene>-<width>-<theme>-<locale>.png`.
Every required scenario is covered, and together they cover all four widths, both themes and both
locales: new thread, active thread, thread + inspector, execution tasks, approval, failed run,
Changes, Source Control (checkout and worktree), Context graph, Settings › Models, command palette,
welcome. The full matrix (70 captures) was reviewed during Stage D; only representative ones are kept.

Comparison with the Demo: same shell geometry, rail, sidebar groups, toolbar, glass layers, token
palette, composer, block styles and breakpoint behaviour. Intended differences: no simulated traffic
lights (native), production-only controls (delegation grant, checks accept, runtime identity, worktree
apply/cleanup) styled in the Demo's vocabulary, Context without note nodes.

### Native macOS (Wails WebKit)

- Built with `scripts/build-macos.sh` and launched with `open "build/bin/LumenCortex Desktop.app"`.
  Window `LumenCortex`, 1440×900. The native close, minimize and full-screen buttons are present
  (accessibility tree), and the hidden-inset title bar adds no extra title bar.
- Walked through the accessibility tree with System Events (zh-CN): Welcome ("打开项目…", recent
  projects) → opened `/private/tmp/c3-e2e/ws2` → new thread ("在 ws2 里想做什么？", composer, rail
  对话/上下文/源代码管理/设置, ⌘K) → opened the persisted C3 thread: transcript, `read_file` /
  `start_task` tool groups, execution task result card ("运行结束 · 待审阅", "检查通过", "1 个文件未提交",
  打开), Conversation/Changes switch → Source Control: project checkout `ws2` (clean) and both real
  session worktrees with their Core branches `lumencortex/229e420afc933079` and
  `lumencortex/543993fb31c47aef`. No agent was started; nothing was written.
- **Blocked:** pixel-level native inspection. `screencapture -l <window>` fails with "could not create
  image from window" because the agent host has no Screen Recording permission. Backdrop blur, font
  rendering, scrollbars, shadows and HiDPI in WebKit are therefore unverified by image. Next step:
  grant Screen Recording to the terminal host, or the owner checks the running app by eye.

## App icon (owner approval required)

The bundle still uses the old placeholder `build/appicon.png` (a "W" tile). It sits in the untracked
`build/` directory owned by the build-repair work, and the reference README requires Dock review
before a production icon, so it was **not** replaced.

Candidate for review in `docs/design/app-icon/`:
- `lumencortex-app-icon-candidate.svg`: 1024 macOS grid (824 px body, 185 px radius), deep-blue tile,
  and the approved A1 glass artwork, the same composition as the in-app `AppIcon`.
- `lumencortex-app-icon-candidate-1024.png`: rendered master.
- `candidate-preview.png`: 512 → 16 px on light and dark, beside the approved reference crop.

Known limits: the glass layer is the approved raster cut to the traced silhouette (337×297 px). It is
sharp at Dock sizes but is not hand-built vector artwork, and below 32 px the triangle void closes up.
An all-vector variant (flat gradient silhouette) was tried and rejected: it loses the approved
three-band ribbon material.

## Housekeeping incident (resolved)

During a fail-before check, `git stash push <untracked path>` failed and the following `git stash pop`
applied the owner's existing `stash@{0}` ("pre-pull: local generated go.mod/go.sum/package-lock.json").
It conflicted on `go.mod`, and its untracked files were not restored. `go.mod` was restored from HEAD,
`go.sum` and `frontend/package-lock.json` were unchanged, and `stash@{0}` is **still in the stash
list, intact**. `go build ./...` passed afterwards. Later fail-before checks used file copies, not stash.

## Open items / owner approvals

1. **App icon:** approve the candidate (or ask for changes). After approval, install it as
   `build/appicon.png` in coordination with the build-repair owner, then check it in the Dock and
   Finder.
2. **Native visual pass:** needs Screen Recording for the agent host, or a manual check by the owner.
3. Context note nodes stay unavailable until Core records notes (no Desktop work possible).
