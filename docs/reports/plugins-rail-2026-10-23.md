# Plugins rail page, plugin entries and build identity - 2026-10-23

Status: **implemented and validated locally; not pushed.** Branch `main`, baseline `0f6d921`.
Scope: LumenCortex-Desktop only. No Core change, no `go.mod`/`go.sum` change, no Skills UI change.

## What changed

| Area | Change |
|---|---|
| Rail | New `插件 / Plugins` page item (Puzzle, ⌘5, palette action, global keydown). Below the page items a hairline separates the pinned plugin entries; bottom-left shows the build version (`v0.1.0`, full identity in the title) above the Settings button. |
| Plugins page | `WorkspaceRoute { kind: "plugins" }`, `WorkspacePage "plugins"`. Sidebar lists Core's plugins (icon, name, lifecycle dot); the body shows the selected plugin: icon, name, id, version, description, state/error, enable switch (write then re-read), entries derived from capabilities, the "在工具栏显示 / Show in toolbar" switch, and a link to Settings → Plugins. Without a project it shows the existing no-project notice. |
| Plugin entries | `lib/plugins.ts` derives entries from capabilities (`session-import` → "导入会话 / Import sessions") and maps `manifest.icon` (`import` → Lucide `FileInput`; unknown/absent → `Puzzle`). The entry opens the existing import dialog with that plugin's import source preselected. |
| Rail pinning | `lib/rail-plugins.ts` stores hidden plugin ids in `localStorage` (`lcx-rail-plugins`) behind `useSyncExternalStore`; default visible. An enabled plugin with a primary entry and not hidden gets one labelled, keyboard-reachable rail button. |
| OMP import | The "从 OMP 导入 / Import from OMP" row and its `onImportOmp` prop chain left `ThreadsSidebar`, `WorkspaceChrome` and `WorkspaceView`. `OmpImportDialog`/`useOmpImport` stay and accept `initialSourceId`; `useOmpImportSheet` gained `sourceId` + `openFor(sourceId)`. The imported session still opens afterwards. |
| Version | Go `App.GetBuildInfo()` returns `buildInfo`; `builtAt` (`json:"builtAt,omitempty"`) is injected by `scripts/build-macos.sh` as `-X main.appBuiltAt=<UTC RFC3339>`. `lib/bridge.ts` mirrors `GetBuildInfo` (AppAPI parity), `types.ts` adds `BuildInfo`, `manifest.icon` is optional. |
| About | Settings → About lists Desktop version, Core module (marked `local replace` with its path), Core runtime version, short commit (dirty flag kept), build time, Go version, platform (`goos/goarch`), plus the existing workspace and database rows, and copies the summary. `health.version` is no longer presented as the app version. |
| Copy | zh + en keys for every new label; the retired `ompImportEntry` key was removed. |

Core's parallel change adds the optional `manifest.icon`; Desktop tolerates its absence today.

## Validation (run at this change)

| Check | Result |
|---|---|
| `cd frontend && npx tsc --noEmit` | clean |
| `cd frontend && npx vitest run` | 75 files, 399 tests passed |
| `go vet ./...` | clean |
| `go test ./...` | `ok ...Desktop`, `ok ...internal/backend` |
| `npx playwright test` (Node 24; visual harness at 1568/1440/1180/820/560, both themes/locales) | 91 passed |
| Browser check | rail (pages, plugin entry, `v0.1.0`) and the Plugins page at 1440×900 inspected |

New/extended tests: `components/plugins/PluginsPage.test.tsx`, `components/app-shell/Rail.test.tsx`,
`components/settings/SettingsPanes.test.tsx` (About rows, local replace, copy), plugin navigation in
`useWorkspaceCommands.test.tsx` and `workspace-route.test.ts`, the `initialSourceId` case in
`OmpImportDialog.test.tsx`, and the Playwright plugin/OMP/version paths.

## Limits

- The native macOS build (`scripts/build-macos.sh`) was not run here; the integrator builds it. The
  `builtAt` injection is in the script and unit-visible through `GetBuildInfo` only in a built binary.
- `frontend/wailsjs/` is generated and was not regenerated or staged.
