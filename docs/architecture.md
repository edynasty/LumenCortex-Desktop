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


## Frontend architecture

The detailed frontend decision and ownership model is documented in [Frontend Architecture](frontend-architecture.md).

Key rule:

- React owns presentation state.
- Core owns execution state.
- `runtime.RunSupervisor` is the only source of truth for live agent runs.

## Agent profiles

The Agents page (rail item `agents`, route `{ kind: "agents" }`) owns a Desktop-specific preset
catalog. A profile is `{ id, name, description, base: "ask" | "agent", instructions, modelRef?,
effort?, policy?, builtin }`; the two built-ins `ask` and `agent` always exist, cannot be deleted
or renamed, and have a fixed base. The catalog is `agents.json` (`{version: 1, profiles: [...]}`)
in the global configuration directory next to `credentials.json`, written atomically through a
temporary file and rename, at most 16 profiles, names 1–40 characters and unique, instructions up
to 8000 characters. A corrupt file falls back to the built-ins with a warning and is not
rewritten until the user saves.

Profiles are a Desktop preset of `runtime.AgentOptions`, not a second runtime. Core owns the
default system prompt, the safety and authority text, the policy and the tool set. The Start path
maps a profile id — never its text — from the composer to `AgentOptions.Instructions`, which Core
appends as the last system message after its default prompt and the skills prompt. Core bounds it
(16 KiB, valid UTF-8) and records only a SHA-256 and length in the decision log. The frontend sends
only `profileId`; the backend resolves the instructions from the file, so the text is never forged
by the renderer or stored in the session. A profile's `base` is the same guard the composer's
Ask/Agent switch used: `ask` forces Core's read-only policy and no delegation whatever the request
carries; a profile `policy` is only a default the user can still change and is clamped by the base.
Model and effort defaults are adopted by the composer when the profile is picked and remain
user-changeable.

Wails APIs: `ListAgentProfiles`, `SaveAgentProfile`, `DeleteAgentProfile`, `ResetAgentProfile`
(`internal/backend/agent_profiles.go`), with typed bridge methods in `frontend/src/lib/bridge.ts`.
