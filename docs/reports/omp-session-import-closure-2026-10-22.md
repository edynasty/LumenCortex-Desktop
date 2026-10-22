# OMP session import integration closure — 2026-10-22

- **Status:** accepted locally (SESSION-005). Not pushed.
- **Commits:** Desktop `85a1081` (imported child marker), `b1575c4` (Core `9581de1` pin, generic
  import API, Settings → Plugins). Core `9581de1` (ADR-0012 plugin platform; OMP import is the
  built-in `omp-import` source plugin).

## Changes

- Core `runtime.SubagentNode` exposes the relation mode, including `imported`.
- The inspector's subagent tree shows `Imported history` / `历史导入` beside the child's run status.
- The import dialog lists the running import sources from Core; with none (plugin disabled) it
  explains why and opens Settings → Plugins; with several it offers a source picker.
- Settings → Plugins shows the catalog (state, errors, failures, capabilities, state file) and
  enables/disables a plugin through Core.

## Validation

Automated (Desktop at `b1575c4` content, Core `9581de1`):

- `go build ./... && go vet ./... && go test -count=1 ./...` — pass.
- `npx tsc --noEmit`, `npx vitest run` (69 files / 343 tests), `npm run build` — pass.
- `npx playwright test` — 88 passed.

Visual stub (`visual.html`, headless Chromium 1440×900): Settings → Plugins lists `omp-import`
running; switching it off shows `Disabled`; the import dialog then shows the disabled-source empty
state, whose button opens Settings → Plugins; re-enabling restores the session list.

Real application (`wails dev` against the committed pin, real Core bindings; isolated
`XDG_CONFIG_HOME=/tmp/lcx-accept/xdg` with a copy of the user's provider config; throwaway Git
workspace `/tmp/lcx-accept/ws`; headless Chromium on the Wails dev server because screen capture
is unavailable on this machine):

| Step | Observed |
| --- | --- |
| Open workspace | `OpenWorkspace("/tmp/lcx-accept/ws")`; `ImportSources()` → `omp`; `Plugins()` → `omp-import` running, state file under the isolated config dir |
| List | Sidebar "从 OMP 导入" → dialog; "所有工作区" + search found the real session `REL: Close pre-release P0s for Daemon switchover` (1.07 MB, 3 subagents) |
| Preview | Counts and the `workspace_mismatch` warning shown; nothing written |
| Import, open | "导入" wrote 4 native sessions (parent + 3 children) and opened the parent thread; history ends with the "从其他运行时导入的历史" notice |
| Inspector | Run tab → 子 Agent 3: ConnectionAudit, ReleaseRunbook, ReleaseConfigs, each "历史导入 · 运行结束" |
| Continue | Prompt "Without calling any tools, … title … how many subagents" → `local/deepseek-v4.1-flash` answered with the correct title and the three subagent names; no tool call ran |
| Re-import | `ImportSession` → `alreadyImported: true`, `sourceChanged: false`, 0 sessions written |
| Disable / enable | `SetPluginEnabled("omp-import", false)` → `ImportSources()` empty, preview fails `import source is not available: "omp"`; enable → source back |
| Source safety | SHA-256 over the session file and its subagent directory identical before and after (`d67c38e7…6d63`); the throwaway workspace stayed clean (`git status` empty) |

Packaged artifacts: `scripts/release-candidate.sh --mode local --arch arm64` from the committed
HEAD and pin passed DMG/ZIP verification, `--version`, `--self-check` and the launch check (see
`release-pipeline-2026-10-22.md`). `scripts/build-macos.sh` rebuilt `build/bin` from the
committed pin (`core: v0.0.0-20261022075503-9581de10ec96`, self-check ok) after `wails dev`
had replaced the development bundle.

## Limits

- The real-application pass ran in Chromium against the Wails dev server, not in the WKWebView
  window: macOS screen capture is unavailable here (`screencapture`: "could not create image from
  display"). Bindings, Core and data were the real ones; WKWebView rendering of these screens is
  covered only by the general native visual check (UX-001, owner).
- Image attachments stay placeholders (SESSION-002); large-preview memory is SESSION-003.
- A still-running OMP task cannot be taken over; an import is history plus continuation.
