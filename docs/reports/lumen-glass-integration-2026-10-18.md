# Lumen Glass production UI integration (2026-10-18)

Status: **in progress** (Stage A foundation underway). Local only, not pushed.

## Scope and baseline

- Production Desktop `main` at `d2d9ff4` (build-repair commit). Untracked build outputs
  (`LumenCortex-Desktop`, `build/`, `frontend/wailsjs/`, `frontend/test-results/`,
  `frontend/package.json.md5`) and the `frontend/dist/.keep` deletion belong to the build-repair
  work and are not touched or staged.
- Visual reference: UI Demo `design/ui-demo` at `aca4b88`
  (`docs/design/Lumen-Glass-Reference/approved-design-reference.png`,
  `frontend/src/demo/`, `docs/reports/lumen-glass-final-2026-10-16.md`). The Demo is read-only here.
- Core pin unchanged (`aa12861`).

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Port Demo tokens (`styles/tokens.css`), base elements (`styles/base.css`) and shell geometry (`components/app-shell/shell.css`) verbatim, then adapt; delete `styles/global.css`. | Single token source; the Demo values are the approved design. |
| D2 | Temporary alias block at the end of `tokens.css` maps pre-Lumen-Glass token names onto the new tokens; deleted once every stylesheet is migrated. | Lets un-migrated surfaces render in the new palette during the cutover. |
| D3 | Native traffic lights stay native (Wails `TitleBarHiddenInset`); the Demo's simulated `.traffic-lights` are not ported. `html[data-chrome="mac-inset"]` reserves their space in the toolbar lead. | No duplicate window chrome; native drag/zoom behaviour. |
| D4 | Drag regions use `--wails-draggable: drag/no-drag` instead of `-webkit-app-region`. | That is the property Wails v2 reads. |
| D5 | Routes: `new-task`, `thread`, `review` (thread Changes view), `scm` (checkout = `main` or a session id), `context`. Providers / Extensions become panes of a Settings sheet instead of routes. | Matches the Demo rail (Threads / Context / Source Control + Settings). |
| D6 | Pane geometry persists as one `lcx-layout` preference (collapsed, sidebar width, inspector width); the old `lcx-sidebar-collapsed` key is read once and removed. ⌘B moves into `AppShell`. | UI preference only; no session state. |
| D7 | Icons go through a concept map (`components/primitives/icons.ts` + `Icon.tsx`, Lucide only). | Demo rule: one glyph per concept. |
| D8 | Context page shows only Core-derivable relations (see Context section, pending). No fabricated graph data. | Prompt §7. |

## Progress

- [x] Tokens, base, shell CSS, brand (`components/brand/`), ResizeHandle ported.
- [x] Primitives restyled: Button, IconButton, SegmentedControl, Drawer; new Icon, AnchoredPopover.
- [x] AppShell (toolbar lead, rail slot, resizable sidebar/inspector, drawers), Rail, toolbar main
      (`WorkspaceTopbar`), Sidebar frame + project switcher, ThreadsSidebar, ThreadRow.
- [x] Route model + layout preference (+ tests rewritten for the new contracts).
- [x] Wire `WorkspaceChrome` / `WorkspaceRouteContent` / `App` to the new shell
      (`useWorkspaceCommands`: pages, settings, palette actions, ⌘K/⌘,/⌘N/⌘1–3, error recovery).
- [x] Settings sheet (`components/settings/`: general, models, permissions, MCP, skills, trust, about);
      provider draft keepalive test moved to `SettingsSheet.test.tsx`.
- [x] Command palette, welcome. Wails title bar → `TitleBarHiddenInset` (`main.go`),
      `isNativeMacWindow()` sets `data-chrome="mac-inset"`.
- [x] Visual harness renders the real `App` over a stubbed bridge (`visual/app-stub.ts`,
      `visual-main.tsx`); the per-scene `VisualFixture*` components are deleted.
- [ ] Playwright `visual-tests/` rewritten against the App harness (old scene URLs no longer exist).
- [ ] Conversation, composer, task cards, inspector restyle.
- [ ] Source Control page (main checkout + session worktrees) and Context page.
- [ ] Remove alias block; visual + native acceptance; screenshots.

## Validation

Stage A commit:
- `npx tsc --noEmit` clean; `npx vitest run` 42 files / 157 tests passed; `npm run build` OK.
- `go build ./...`, `go vet . ./internal/backend` OK.
- Rendered check: harness at 1440 light zh-CN compared with Demo new-thread — shell geometry,
  rail, sidebar groups and toolbar match; composer/new-thread body still pre-Lumen-Glass (Stage B).
- Playwright suite not run: pending rewrite (see Progress).

## Open items / owner approvals

- Production app icon from the A1 mark still needs owner review in the real Dock.
