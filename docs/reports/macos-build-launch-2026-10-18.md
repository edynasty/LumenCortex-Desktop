# macOS build, install and native launch (2026-10-18)

Status: **fixed and verified locally; not pushed.** Desktop worktree at `9282778` plus the changes below; Core pin unchanged (`aa12861`).

## Symptoms

- `open "build/bin/LumenCortex Desktop.app"` failed with "The application cannot be opened because its executable is missing."
- `Contents/MacOS` was empty while `Contents/Info.plist` declared `CFBundleExecutable = LumenCortex`.
- The user's zsh reported `zsh: command not found: wails`.

## Root causes

1. **Missing executable: `wails dev` writes into the production bundle and deletes its binary on exit.**
   Wails v2.16 builds both modes into the same directory (`pkg/commands/build/build.go:92`, `BinDirectory = build/bin`) and the same bundle name (`pkg/commands/build/packager.go:69`, project name + `.app`). In dev mode `build.Build` still sets `Pack: true`, moves the dev binary to `Contents/MacOS/<CFBundleExecutable>` (`packager.go:82`), and on shutdown `killProcessAndCleanupBinary` removes that path (`cmd/wails/internal/dev/dev.go:188`). The C3 `wails build` at 16:06 produced a complete bundle; the `wails dev` sessions that followed replaced the binary with the dev build and removed it on exit, leaving a valid-looking shell. Reproduced twice: after each `wails dev` exit `Contents/MacOS` was empty and `scripts/verify-macos-bundle.sh` failed with "declared executable is missing".
2. **`wails: command not found`: `~/go/bin` was not on `PATH`.**
   The CLI was installed at `/Users/tangxingpeng/go/bin/wails` (v2.16.0), but no shell configuration added `$(go env GOPATH)/bin`. `zsh -ic 'which wails'` failed before the fix.

A third defect surfaced while verifying dev mode: Wails' dev server (`localhost:34115`, `internal/project/project.go:182`) and the Vite dev server (`frontend/vite.config.ts`, `127.0.0.1:34115`) bound the same port, so `wails dev` logged `ERR | listen tcp 127.0.0.1:34115: bind: address already in use` and browser dev mode could not serve the Wails IPC endpoint.

## Environment changes (user-level, reversible)

| Change | Detail |
|---|---|
| `~/.zshrc` | Appends `~/go/bin` to `PATH` when absent (`case ":$PATH:" in …`). Verified with `zsh -ic 'which wails'` → `/Users/tangxingpeng/go/bin/wails`, `wails version` → v2.16.0. |
| `com.wails.lumencortex-desktop` defaults | `NSOSPLastRootDirectory` was set to the workspace folder during verification so the native picker opens there. This is the app's own remembered picker folder; no application data was modified. |

No global package installs, no system changes. Xcode Command Line Tools, Go, Node and Wails were already present.

## Repository changes

| File | Change |
|---|---|
| `scripts/build-macos.sh` | `wails build -platform darwin/$(uname -m)` followed by bundle verification. Resolves `wails` from `PATH` or `$(go env GOPATH)/bin`. |
| `scripts/verify-macos-bundle.sh` | Fails when the bundle, `Info.plist`, `Contents/Resources` or `Contents/MacOS` is missing, when `CFBundleExecutable` is missing/empty, when the declared executable is absent, empty or not executable, when it is not Mach-O, when the architecture does not match (default: host arch), or when the ad-hoc signature does not verify. |
| `wails.json` | `"devServer": "localhost:34116"` so Wails' dev server no longer collides with Vite on 34115. |
| `frontend/package.json` | `"engines": {"node": ">=22.10"}`. Vite 6 imports `constants` from `node:fs/promises`; Node 16 (found at `/usr/local/bin/node` on this host) fails with a cryptic ESM error. |
| `README.md` | Correct Go requirement (1.25+, matching `go.mod`), `PATH` setup, dev-mode behaviour (dev deletes the bundle binary), build/verify/launch commands. |
| `AGENTS.md`, `docs/ai-development-standard.md` | Canonical desktop build command is now `scripts/build-macos.sh` (replaces `wails build -clean -platform darwin/universal`). |

## Versions and binary

| Item | Value |
|---|---|
| macOS | 27.0.1 (26A434), arm64 (Apple M1 Pro) |
| Go | go1.26.5 darwin/arm64 (`/opt/homebrew/bin/go`) |
| Wails CLI | v2.16.0 (`/Users/tangxingpeng/go/bin/wails`) |
| Node / npm | v24.20.0 (mise) / 11.19.0 |
| Xcode | 27.0 (27A266a), CLT installed |
| Bundle | `/Users/tangxingpeng/IdeaProjects/me/LumenCortex-Desktop/build/bin/LumenCortex Desktop.app` |
| Executable | `Contents/MacOS/LumenCortex` — `Mach-O 64-bit executable arm64`, `lipo -archs` → `arm64`, ad-hoc signed (`codesign -dv`: `Signature=adhoc`, `Format=app bundle with Mach-O thin (arm64)`) |

`scripts/verify-macos-bundle.sh` was exercised against the broken bundle, a bundle with the executable removed, a bundle without `Info.plist`, and a wrong-architecture request; all failed with the expected message. The rebuilt bundle passes.

## Development mode

`wails dev` from the user's interactive zsh (`zsh -ic`) starts the Go backend, Vite (34115), the Wails dev server (34116) and a native window. Observed:

- `Vite Server URL: http://127.0.0.1:34115/`, `Using DevServer URL: http://localhost:34116`; no bind error after the `wails.json` change.
- Native window loaded the real UI (accessibility tree exposes the full React interface); recent projects listed and a workspace opened; Core reported `运行时在线` (runtime online), version `0.1.0-preview`.
- The C3 workspace (`/tmp/c3-e2e/ws2`) loaded its persisted session and C3 surfaces.
- On exit the dev binary is removed from the bundle, as documented in the README; a production build is required before launching the `.app`.

## Native `.app` launch

`open "build/bin/LumenCortex Desktop.app"` launches the process and keeps it running. Native window: title `LumenCortex`, position 180,73, size 1440×932 (matches `main.go` 1440×900 plus title bar). The accessibility tree (WKWebView content) shows the real frontend: sidebar, session list, composer, Inspector.

Verification limits:

- **Screen Recording is denied for the executing process** (`screencapture` → "could not create image from display"), so no pixel screenshots of the native window. UI evidence is the live macOS accessibility tree (roles, labels, values) read from the running app, plus the window geometry and process state.
- Accessibility automation is available: workspace selection, session navigation, Inspector tabs and menus were driven through AX actions.

Persisted data: opening the Desktop workspace showed its existing session; opening `/tmp/c3-e2e/ws2` showed 1 existing session with its full transcript, task results and execution tasks — no data loss.

## C3 smoke test in the packaged app

| Surface | Observed |
|---|---|
| Conversation loading | Existing session opened; transcript from the C3 live run rendered (user/assistant/tool messages, `task_result` rows). |
| Run status vs resolution | Header `本轮已结束` (Turn ended) with resolution `可以审阅` (Ready for review). |
| Execution task cards | Section `执行任务` with 2 tasks: interrupted (`已中断`, `未验证`, `没有改动`, `1 个工作单元未完成`, `context canceled`) and `运行结束 · 待审阅` with `检查通过` and `1 个文件未提交`; each has Open and worktree branch. |
| `task_result` rows | Two rows: finished/review with checks passed and 1 uncommitted file; interrupted. |
| Task State panel | Resolution radio group (进行中 / 已完成 / 已放弃), current `可以审阅`, brief editor, references, context window with reset. |
| Checks panel | Commit + clean tree, empty check list with configuration hint, result history. |
| Delegation control | Menu lists 不委派 / 先提议 / 隔离执行 with the "applies from the next turn" note; per-thread control present in the composer. |
| Child thread | Open on a task navigates to the child thread: worktree runtime, branch, `本轮已结束`, Task State `进行中`, remove-worktree action. |
| Model configuration | Model & providers screen loads; global/project scope, provider catalog empty, add-provider and advanced JSON actions. |

Not exercised natively (see blockers): live model turn, proposal card → Start, running task Stop subtree.

## Validation run

| Check | Result |
|---|---|
| `go build ./...` (Desktop) | pass |
| `go vet ./...` (Desktop) | pass |
| `go test -count=1 ./...` (Desktop) | pass (`internal/backend` 13.8s) |
| `npm test` (frontend) | 42 files, 157 tests pass |
| `npm run build` (frontend) | pass |
| `scripts/build-macos.sh` | pass; bundle verification OK, arm64 |
| `scripts/verify-macos-bundle.sh` negative cases | fail as intended (empty bundle, missing plist, wrong arch) |
| `wails dev` | pass (native window, Core online, C3 data) |
| `open` + AX inspection of the packaged app | pass |

## Remaining blockers

1. **No configured model provider and no provider credential in the environment.** `~/.config/lumencortex/lumencortex.json` does not exist, the workspace has no `lumencortex.json`, and no `*_API_KEY`/token variables are exported. Live turns, a new proposal card, Start, and a running-task Stop subtree therefore could not be exercised in this session. These flows are covered by the C3 report's live run (dev mode) and by Core/Desktop tests.
2. **Screen Recording permission denied** for the automation process, so native screenshots are unavailable; acceptance used the accessibility tree, window geometry, process state and Core-backed data instead.

## Reproduce

```bash
cd ~/IdeaProjects/me/LumenCortex-Desktop
scripts/build-macos.sh
open "build/bin/LumenCortex Desktop.app"
```

Development:

```bash
wails dev        # after: rebuild with scripts/build-macos.sh before opening the .app
```
