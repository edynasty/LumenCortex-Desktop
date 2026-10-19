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
the platform secret store (the macOS Keychain; a non-macOS build has no store and reports it
unavailable, while `{env:NAME}` keeps working). Keychain items are generic passwords under the
service `com.lumencortex.desktop.provider-credentials`, accessible only when unlocked and bound
to this device; the account is the derived secret name, so no item is ever adopted by another
install. The Desktop derives names deterministically from the scope and provider id, within
Core's secret NAME pattern.

The key crosses the Go boundary exactly once, as the `SaveProviderCredential` argument; every
status, error, event and log line names only the reference. Store writes are bounded in time so a
stalled Keychain cannot block a UI callback indefinitely, and a failed configuration save rolls
the Keychain write back. Connection tests and model discovery speak each protocol's own
authentication (Bearer for openai-compatible, `x-api-key` plus `anthropic-version` for
anthropic-messages) and redact the key from every error an upstream echoes it in.


## Frontend architecture

The detailed frontend decision and ownership model is documented in [Frontend Architecture](frontend-architecture.md).

Key rule:

- React owns presentation state.
- Core owns execution state.
- `runtime.RunSupervisor` is the only source of truth for live agent runs.
