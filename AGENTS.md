# AGENTS.md — LumenCortex Desktop

This file is the repository-level contract for AI coding agents.

Normative language:
- **MUST / MUST NOT**: required.
- **SHOULD / SHOULD NOT**: expected unless there is a documented reason.
- **MAY**: optional.

Before changing code, read:

1. [docs/frontend-development-standard.md](docs/frontend-development-standard.md)
2. [docs/ai-development-standard.md](docs/ai-development-standard.md)
3. [docs/architecture.md](docs/architecture.md)
4. [docs/lumencortex.schema.json](docs/lumencortex.schema.json) when changing providers/models.

## Product direction

LumenCortex Desktop is a local-first coding-agent workspace. The interaction model is:
- project/workspace oriented,
- thread/session oriented,
- agent-first rather than dashboard-first,
- compact and native-feeling,
- Chinese-first with English available,
- durable in Core/SQLite and bounded in frontend memory.

Visual references such as Codex or Vetta are references for information architecture and interaction quality, not assets to copy.

## Architecture boundary

```text
React / TypeScript UI
        │
        │ typed Wails bridge only
        ▼
Desktop Go adapter
        │
        ▼
LumenCortex Go runtime
        │
        ├── sessions
        ├── agents
        ├── tools
        ├── provider execution
        └── persistence
```

The Desktop frontend MUST NOT reimplement Core runtime behavior.

## Mandatory frontend rules

- Use React + TypeScript.
- Use **Lucide React** for general UI icons.
- Do not add hand-drawn SVG icon sets, emoji icons, Unicode-symbol buttons, or a second icon library.
- Chinese is the default UI language.
- User-visible copy MUST be centralized; do not scatter new bilingual strings through components.
- UI color, spacing, radius, typography and elevation MUST come from shared design tokens/CSS variables.
- New UI MUST work at these widths: 1440, 1180, 820, and 560 px.
- Long-lived UI collections MUST be bounded, paginated, or virtualized.
- Wails calls MUST go through `frontend/src/lib/bridge.ts`.
- Shared domain types MUST live in `frontend/src/types.ts` or a domain-specific type module.
- Do not store API keys in localStorage, sessionStorage, React persisted state, workspace SQLite, logs, or screenshots.
- Provider secrets SHOULD use `{env:VARIABLE_NAME}`.

## Mandatory Go/backend rules

- Desktop backend remains a thin adapter over LumenCortex Core.
- Runtime behavior belongs in Core unless it is Desktop-specific integration.
- Every new Wails API MUST have:
  1. Go implementation,
  2. typed frontend bridge method,
  3. TypeScript types,
  4. backend test when behavior is non-trivial.
- Context cancellation MUST propagate to I/O.
- Long-running operations MUST NOT block Wails UI callbacks indefinitely.
- Provider/model identity MUST be durable and explicit.
- Workspace configuration is `lumencortex.json`; the schema is `docs/lumencortex.schema.json`.

## Provider/model contract

Model references use:

```text
provider/model
```

Example:

```text
deepseek/coder
```

A provider may define:
- display name,
- package/adapter,
- `baseURL`,
- exact `endpoint`,
- API key or environment reference,
- multiple models,
- model display name,
- real upstream `modelID`,
- model limits.

The everyday UI SHOULD expose a model picker, not raw endpoint/key fields. Raw provider configuration belongs in the Provider configuration surface.

## AI change discipline

AI agents MUST:
- inspect relevant code before editing;
- preserve existing architecture unless the task explicitly changes it;
- make the smallest coherent change that fully solves the task;
- remove abandoned scaffolding;
- avoid duplicate implementations;
- add/update tests for behavior changes;
- update docs/schema when contracts change;
- validate frontend, backend and Wails build when affected;
- report exact validation status rather than claiming success without evidence.

AI agents MUST NOT:
- silently replace an established design system;
- add a dependency for a trivial function already supported by the stack;
- introduce a second source of truth for sessions, providers, runtime state or configuration;
- invent backend capabilities in the UI;
- persist secrets for convenience;
- leave mock/demo behavior on the production path;
- claim asynchronous/background work.

## Required validation

Frontend changes:

```bash
cd frontend
npm install
npm run build
```

Backend changes:

```bash
go test -v -timeout 90s ./internal/backend
go vet ./internal/backend
```

Desktop integration changes:

```bash
wails build -clean -platform darwin/universal
```

A change is not complete until all affected checks pass or the failure is explicitly documented.

## Definition of done

A completed change:
- solves the requested user workflow,
- follows the frontend standard,
- follows the AI development standard,
- has no obvious responsive regression,
- has no unbounded new in-memory collection,
- has no new secret persistence,
- has tests for non-trivial backend behavior,
- builds successfully,
- leaves the repository cleaner or equally maintainable.
