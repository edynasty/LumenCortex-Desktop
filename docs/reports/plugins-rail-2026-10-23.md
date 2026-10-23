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

## Native app check (integration, after Skills UI `c7d0cdb` and Core `v0.1.3`)

`scripts/build-macos.sh` built `build/local/LumenCortex Desktop.app` (self-check ok); `--version`
reports appVersion 0.1.0, commit `c7d0cdb`, `builtAt` 2026-10-23T04:07:53Z, Core `v0.1.3`, runtime
`0.1.3-preview`. The app was driven through the macOS accessibility tree (the agent's process may not
capture the screen), against the owner's real configuration and the LumenCortex workspace:

- Rail: 对话 / 上下文 / 源代码管理 / 智能体 / 插件, the pinned 导入会话 button, 桌面版本 v0.1.0, 设置.
- 插件 page: OMP session import, 运行中, version 1.0.0, API 1, capability `session-import`, entry
  导入会话, 在工具栏显示 on. Turning it off removed the rail button; on restored it.
- Rail 导入会话 opened 从 OMP 导入会话 with the current workspace's real OMP sessions listed.
- 桌面版本 opened Settings → 关于: 桌面版本 v0.1.0, Core 模块 v0.1.3, Core 运行时 0.1.3-preview, 提交
  c7d0cdb, 构建时间, Go go1.26.5, darwin/arm64, project and database paths, 复制版本信息.
- Settings → 技能 → 全局: the nine `~/.agents/skills` entries with 全局 / .agents / 只读 badges, 链接 on
  the two linked skills, the broken `poc-vulnerability` link with Core's error, "8 个已启用的 Skill 会进入运行",
  the catalog hint; selecting company-deploy shows path, root, real path, read-only content and
  另存为 LumenCortex 副本. No enable state was changed on the owner's real skills.

## Limits

- Visual appearance of the native window was not captured (screen recording is not granted to the
  agent's process); the browser visual harness and Playwright cover the layout. `OWNER_CHECK` in TODO UI-005.
- `frontend/wailsjs/` is generated and was not regenerated or staged.
