# LumenCortex Desktop

A lightweight desktop workspace for the LumenCortex bounded-memory coding-agent runtime.

The first implementation targets macOS with **Wails v2 + Go + React/TypeScript**. The Desktop embeds the public LumenCortex Go `runtime.Engine` in-process by default instead of starting a second agent daemon.

## Current milestone

Implemented in the first vertical slice:

- open a local workspace with the native directory picker,
- embed the LumenCortex Go runtime,
- reuse the workspace's `.lumencortex/lumencortex.db`,
- list and create durable Sessions,
- receive bounded live runtime/tool events,
- run a shell smoke command inside a Session,
- show runtime memory budget/pressure information,
- keep only the latest 200 transient UI events,
- build the frontend with React + Vite,
- test the backend adapter against the real embedded runtime.

The full Go Agent Loop, Workflow, Cognitive Graph, LSP/MCP and Subagent parity is being migrated in the Core repository. Desktop deliberately does not reimplement those systems.

## Architecture

```text
React / TypeScript
        │
        │ Wails bindings
        ▼
Desktop Go adapter
        │
        ▼
LumenCortex runtime.Engine
        │
        ├── SQLite Sessions
        ├── bounded event stream
        ├── bounded tool output
        └── resource budget
```

See [docs/architecture.md](docs/architecture.md).

## Development

Requirements (macOS):

- Go 1.25+ (the version in `go.mod`)
- Node.js 24+
- Wails v2.16.0+
- Xcode Command Line Tools (`xcode-select --install`)

`go install` writes binaries to `$(go env GOPATH)/bin` (`~/go/bin` by default). That directory must be on `PATH`, otherwise `wails: command not found` even though the CLI is installed:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@v2.16.0
export PATH="$HOME/go/bin:$PATH"   # add this line to ~/.zshrc to make it permanent
wails version
wails doctor
```

### Development mode

```bash
wails dev
```

This starts the Go backend, the Vite dev server and a native window. `wails dev` builds its development binary into `build/bin/LumenCortex Desktop.app` and **deletes that binary when it exits**. `build/bin` is Wails' scratch directory: nothing there is kept or trusted.

### Native application

```bash
scripts/build-macos.sh
open "build/local/LumenCortex Desktop.app"
```

`scripts/build-macos.sh` runs `wails build -platform darwin/$(uname -m)` and then `scripts/verify-macos-bundle.sh`, which fails when `Contents/MacOS` is empty, `CFBundleExecutable` is missing or empty, the declared executable is absent or not executable, the binary is not Mach-O, its architecture does not match, or the ad-hoc signature does not verify. Only a bundle that passes is copied to `build/local/LumenCortex Desktop.app`; the one it replaces moves to `build/local/.previous/`, and a failed build leaves both untouched, so `wails dev` cannot break the local build. A working tree with uncommitted changes is recorded as commit `<sha>-dirty` in `--version`. Pass extra `wails build` flags as arguments (for example `scripts/build-macos.sh -v 2`). Release artifacts come only from `scripts/release-candidate.sh` (see [docs/release-process.md](docs/release-process.md)).

Frontend only:

```bash
cd frontend
npm install
npm run dev
```

The frontend-only browser mode can render the shell, but Go-bound actions require running through Wails.

## Memory model

Desktop follows the Core invariants:

```text
Session size     != RAM size
Tool output size != RAM size
Graph size       != RAM size
Task duration    != linear RSS growth
```

The UI must use paging/virtualization/bounded buffers for structures that can grow with task duration. Durable Session and cognitive state belong to Core storage rather than duplicated frontend state.


## Provider configuration

LumenCortex Desktop supports a global provider catalog at `~/.config/lumencortex/lumencortex.json` plus an optional `lumencortex.json` in the workspace root. Workspace settings override matching global provider/model settings. Model references use `provider/model`, similar to OpenCode.

```json
{
  "$schema": "https://raw.githubusercontent.com/edynasty/LumenCortex-Desktop/main/docs/lumencortex.schema.json",
  "model": "deepseek/coder",
  "providers": {
    "deepseek": {
      "name": "DeepSeek",
      "package": "openai-compatible",
      "settings": {
        "baseURL": "https://api.deepseek.com/v1",
        "apiKey": "{env:DEEPSEEK_API_KEY}"
      },
      "models": {
        "coder": {
          "name": "DeepSeek Coder",
          "modelID": "deepseek-chat",
          "limit": {
            "context": 65536,
            "output": 8192
          }
        }
      }
    }
  }
}
```

Configuration is read, merged, validated and saved by LumenCortex Core (`config` package); Desktop is an adapter over it and keeps no second resolver. `docs/lumencortex.schema.json` is Core's canonical schema, byte for byte.

- **Model picker.** It lists Core's catalog (`Config.Catalog`), without models that set `toolCalling: false`, and marks a provider whose `{env:VARIABLE_NAME}` is not set. A new task starts from the configured `model`; an existing session shows the model it is pinned to (`SessionInfo.modelRef`) and is never moved by a later change of the default. `AgentOptions.ModelRef` is sent only when you pick a model other than the one shown. Candidate selection and failover stay in Core.
- **Provider settings.** The panel edits one file at a time (global, or the workspace override) through `config.ReadDocument` and `config.Save` with the file's digest. A file that changed since it was read is a conflict: nothing is written and the panel shows the file as it is now. Fields the panel does not edit (`failover`, `subagentModel`, `effort`, `checks`, `trustedWorkspaces`, headers, timeouts, `reasoning`, `toolCalling`, modalities) are kept on every save.
- **Workspace trust.** A workspace `lumencortex.json` may define providers and checks only when the workspace is listed in the global `trustedWorkspaces`; otherwise Core ignores them and Desktop shows the `untrusted_override` warning with a "Trust this project" action, which adds the canonical path to the global file only.
- **Secrets.** `settings.apiKey` supports `{env:VARIABLE_NAME}`; a literal key is refused. API keys and header values never cross the Wails bridge.

## Engineering standards

Repository development is governed by:

- [AGENTS.md](AGENTS.md) — mandatory repository contract for AI coding agents.
- [Frontend Development Standard](docs/frontend-development-standard.md) — UI/UX, responsive layout, icons, state ownership, provider UX, i18n, and frontend acceptance rules.
- [AI Development Standard](docs/ai-development-standard.md) — architecture boundaries, implementation discipline, security, bounded-memory rules, testing, validation, and definition of done.

For AI-assisted development, read `AGENTS.md` first. These standards use MUST/SHOULD language intentionally; changes that conflict with them should update the standard explicitly rather than silently bypass it.
