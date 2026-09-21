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

Requirements:

- Go 1.27+
- Node.js 24+
- Wails v2.16.0+

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@v2.16.0
wails doctor
wails dev
```

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

The Desktop model picker is populated from the effective merged catalog. With no workspace open, the Provider settings surface edits the global catalog; with a workspace open, it edits the workspace override. `settings.apiKey` supports `{env:VARIABLE_NAME}`; environment references are recommended so secrets do not need to be stored in either config file. If no configured model is selected, the existing `LCX_MODEL`, `LCX_BASE_URL`, `LCX_ENDPOINT`, and `LCX_API_KEY` environment fallbacks remain available.


## Engineering standards

Repository development is governed by:

- [AGENTS.md](AGENTS.md) — mandatory repository contract for AI coding agents.
- [Frontend Development Standard](docs/frontend-development-standard.md) — UI/UX, responsive layout, icons, state ownership, provider UX, i18n, and frontend acceptance rules.
- [AI Development Standard](docs/ai-development-standard.md) — architecture boundaries, implementation discipline, security, bounded-memory rules, testing, validation, and definition of done.

For AI-assisted development, read `AGENTS.md` first. These standards use MUST/SHOULD language intentionally; changes that conflict with them should update the standard explicitly rather than silently bypass it.
