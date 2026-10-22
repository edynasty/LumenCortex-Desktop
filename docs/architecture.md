# LumenCortex Desktop architecture

The Desktop application is a client shell around the public LumenCortex Go runtime package.

```text
React / TypeScript
      │
      │ Wails bindings + bounded event stream
      ▼
Desktop Go adapter
      │
      ▼
LumenCortex runtime.RunSupervisor
      │
      ▼
LumenCortex runtime.Engine
      │
      ├─ Sessions / SQLite
      ├─ Tool streams
      ├─ Workflow / Agent (as Go parity lands)
      └─ Cognitive runtime (as Go parity lands)
```

## Memory rules

The Desktop follows the same bounded-memory contract as Core:

- Session lists and histories are paged.
- Runtime event subscribers are bounded.
- The React activity list retains only a fixed recent window.
- Tool output is streamed; the UI must not accumulate an unbounded terminal transcript.
- Persistent state belongs in the Core SQLite store, not duplicated in frontend state.

## Runtime mode

The default target is **embedded mode**: Wails loads the public LumenCortex `runtime` package in the same Go process. This avoids a duplicate daemon, duplicate SQLite/cache state, and IPC serialization overhead.

A daemon/remote mode may be added later for isolation and remote execution, but it is not the default architecture.

## Provider protocols and credentials

Providers speak the wire protocol their catalog `package` selects — `openai-compatible` (chat
completions) or `anthropic-messages` — dispatched by Core's `provider.FromModel`. The Desktop
injects that dispatcher as `runtime.Options.ProviderFactory` when it opens an Engine, so every run
uses the correct protocol and resolves its API key through the Desktop's credential resolver.

Provider keys are never stored in `lumencortex.json`, the database, logs or frontend state. The
file holds only a reference — `{env:NAME}` reads the process environment, `{secret:NAME}` reads
Core's file-backed credential store: one `credentials.json` (mode 0600, atomic writes, advisory
cross-process lock) in the global configuration directory, shared with the CLI so both hosts see
the same secrets. It is not a secrets manager — the file is not encrypted at rest; it is protected
by file permissions and the user account, the trust level of an environment variable. The Desktop
derives secret names deterministically from the scope and provider id, within Core's secret NAME
pattern, so no two providers ever collide in the store.

The key crosses the Go boundary exactly once, as the `SaveProviderCredential` argument; every
status, error, event and log line names only the reference. That argument is what the user typed
into the single API key field, classified on save: a `${NAME}` (or `{env:NAME}`) placeholder
becomes the provider's `{env:NAME}` reference — nothing is stored, and any previously stored key
of the provider is deleted so no stale secret remains — while anything else is a literal key that
goes to the store. A value that starts like a placeholder or a `{secret:..}` reference but is not
a valid one is refused (Spring-style defaults would put a literal secret in the configuration);
a key that merely contains `$` or `{` elsewhere stays a literal. Store calls are bounded in time so a
stalled store lock cannot block a UI callback indefinitely, and a failed configuration save rolls
the store write back. Connection tests and model discovery speak each protocol's own
authentication (Bearer for openai-compatible, `x-api-key` plus `anthropic-version` for
anthropic-messages) and redact the key from every error an upstream echoes it in.

### Reasoning settings

A model's `reasoning` object is part of the provider catalog the panel edits: `format` (how effort
is encoded) and `efforts` (the levels the model accepts). The panel never carries its own list of
either: `App.GetReasoningFormats(pkg)` returns `config.ReasoningFormats` for the provider's
`package`, and `App.GetReasoningEfforts` returns Core's five levels, so a value Core adds or drops
appears in the form without a frontend change. `reasoning.echo` stays outside the DTO and survives
every save, like `headers` and `timeouts`.

Core validates the merged catalog when it loads it, which is too late for an editor: the save path
therefore refuses a format the package does not implement and adaptive with `none` (adaptive
thinking cannot be turned off) before `config.Save` runs, naming the same key Core's error names
(`providers.<id>.models.<key>.reasoning.*`). The refusal is shown in the model form itself. The
form additionally drops `none` when the user picks adaptive, so the pairing is not offered.

## Native window integration (macOS)

Go owns the menu bar (`menu.go`): the system App menu (About, Hide, Quit), File (New Thread ⌘N,
Settings… ⌘,, Hide Window ⌘W), the system Edit menu, View (Command Palette ⌘K, Toggle Sidebar ⌘B)
and the system Window menu. Wails v2.16 builds the App, Edit and Window menus natively with fixed
English titles; File and View follow the app language through the bound `SetMenuLocale`, which the
frontend calls at start and whenever the language changes (default 中文). Every custom item except Hide
Window emits one `menu:command` event; `lib/bridge.ts` exposes it as `onMenuCommand`, and `useWorkspaceCommands` and
`AppShell` act on it. `SetMenuLocale` returns whether a native menu is installed; while it is, the
webview's own handlers for those four keys stand down (`lib/native-menu.ts`), so each command fires
once. In a browser and off macOS they keep working.

⌘W hides the app (`runtime.Hide`, which is `[NSApp hide:]`), so the app stays reachable from the
Dock; `runtime.WindowHide` only orders the window out and Wails v2.16 has no
`applicationShouldHandleReopen`, so that window could not be brought back. Quitting is ⌘Q's job
alone (`quit.go`): `OnBeforeClose` asks with a native dialog when a run is in progress, and the
window's close button is the same quit request, so closing the single window asks the same way.

The window background shows wherever the webview has not painted (launch, live resize, overscroll).
Go starts it from the system appearance (`appearance.go`); `lib/theme.ts` then sets it to the
resolved theme's `--bg-window` through the Wails runtime, so the native colour cannot drift from CSS.

## Frontend architecture

The detailed frontend decision and ownership model is documented in [Frontend Architecture](frontend-architecture.md).

Key rule:

- React owns presentation state.
- Core owns execution state.
- `runtime.RunSupervisor` is the only source of truth for live agent runs.

## Agents

Core owns the agent catalog (ADR-0009): the `agents` key of `lumencortex.json`. The four built-ins
`ask` (conversation, read-only, no delegation), `agent` (conversation, no cap, the default),
`explore` (read-only children) and `worker` (workspace children) always exist; a file may set only
their `instructions`, `effort` and `models`. A custom agent adds `name`, `description`, `use`
(`conversation`/`delegation`/`both`), `policy` and `delegation` ceilings, instructions and an
ordered `models` list of at most 8 `{model, effort?}` candidates. Desktop keeps no catalog of its
own: `internal/backend/agents.go` translates `config.Effective().Agents` into the DTO the page
edits and writes the global file through `config.Save` with the digest it read, exactly like the
concurrency and provider saves. A stale digest or an invalid agent writes nothing.

The Agents page (rail item `agents`, route `{ kind: "agents" }`) lists the merged catalog with each
entry's `source` (`builtin`, `global` or `workspace`) and `digest`. Built-ins carry a badge, cannot
be deleted, and their name, description, use and ceilings are read-only; instructions (with a 16 KiB
counter), effort and the ordered model list stay editable, and Reset clears that override. A custom
agent is written whole. A workspace definition is shown read-only, because the page writes the
global file: it is changed where it lives.

The run path names an agent, never its text. `AgentConfig.agent` becomes `AgentOptions.Agent`, and
Core applies the agent's instructions and caps `Policy` and `Delegation` by its ceilings; Desktop
sends only the user's grant, so the Ask/Agent composer switch and the Desktop-side cap are gone.
Switching agent re-pins the model to the agent's first model unless the same Start names one, which
is why the composer's model picker sends a model only when the user explicitly picks one.
`SessionInfo.Agent` reports the thread's pinned agent, and the composer shows it; `ErrUnknownAgent`
(a removed pin) and `ErrAgentNotForConversation` are mapped to copy that asks the user to pick an
agent.

The retired `agents.json` (`{version: 1, profiles: [...]}`) is imported once, the first time the
catalog is read: custom profiles become custom agents (id derived from the name, `base: ask` →
read-only/no delegation, `base: agent` → no ceilings, the legacy `policy` default dropped per
ADR-0009 D6), built-in Ask/Agent edits become overrides of `ask`/`agent`, and a model outside the
catalog is dropped with a warning. The write is one `config.Save`; then the file is renamed to
`agents.json.imported` (never deleted) and the outcome is recorded in `agents.import.json` so the
page keeps reporting what was skipped, including entries beyond the 16-agent limit.

The Agents page shows that outcome as a one-time notice only when the import changed something (a
custom agent, a built-in override, a skip or a warning) and the user has not dismissed it:
`agents.import.json` gains `dismissedAt` (`App.DismissAgentImport`), and a record written before the
field existed reads as not dismissed. An `alreadyImported` record whose import changed nothing
shows nothing.

**Retirement (0.3).** Desktop stops reading `agents.json` in 0.3: no import, no rename. A file
still present at that point is left untouched and the Agents page shows a read-only notice naming
its path, so the data is never destroyed and never silently imported twice. Removing this
paragraph means the removal has landed.

`subagentModel` is retired: a file that still sets it fails to load with
`config.ErrSubagentModelRetired`, and the error toast offers a one-click Migrate
(`App.MigrateSubagentModel`) that calls `config.MigrateSubagentModel` on the global file and the
open workspace file, then reloads.

### Effective prompt

The editor's second view shows what a run of the agent would actually send. `App.GetEffectivePrompt`
passes the page's request — the agent, the host's `policy`/`delegation` grant, the open session id
when there is one — straight to `Engine.EffectivePrompt`, and renders Core's answer: every layer in
order with its `kind`, `source`, `scope`, `included`, `reason`, `bytes` and text, and every tool
grouped by its `source` (`builtin`, `task`, `lsp`, `mcp:<id>`, `delegation`) with the filter that
withholds it. Desktop assembles nothing: it cannot show a prompt the run would not send, and a
project `AGENTS.md` appears as "not loaded · workspace not trusted" exactly because Core says so.
The header shows the workspace's trust state and reuses the existing `TrustWorkspace` path; after a
trust the panel re-reads, because trust changes which project inputs Core loads. The tab is a pure
read — no run starts, no lock is taken — and without an open workspace there is no Engine, so the
tab shows the open-a-project message. A new agent has to be saved first (Core resolves the agent
from its catalog), and an unsaved draft says that the panel describes the saved version.

Wails APIs: `GetAgents`, `SaveAgent`, `DeleteAgent`, `MigrateSubagentModel`, `GetEffectivePrompt`
(`internal/backend/agents.go`, `internal/backend/prompt.go`), with typed bridge methods in
`frontend/src/lib/bridge.ts`.
