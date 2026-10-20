# Agent catalog on Desktop (ADR-0009 A2)

- **Date:** 2026-10-20
- **Scope:** LumenCortex Desktop only. Core was pinned at `8998c25` for A2 and is now at `6935aa2` (A3); see the follow-up section.
- **Supersedes:** [`agent-profiles-2026-10-19.md`](agent-profiles-2026-10-19.md) (Desktop `agents.json` profiles and the Ask/Agent switch).
- **Core authority:** `docs/adr/0009-agent-catalog-and-model-lists.md`, `docs/go-provider.md` ("Agents", "Agents at Start"), `docs/lumencortex.schema.json` (`agents`, `$defs/agent`, `$defs/agentModel`).

## What changed

### Core owns the catalog; Desktop edits it

`internal/backend/agent_profiles.go` (the `agents.json` store: `AgentProfile`, read/write,
`profileInstructions`, `List/Save/Delete/ResetAgentProfile`) is deleted. `internal/backend/agents.go`
replaces it:

- `Agents()` reads `config.Load(...).Effective().Agents` and returns `AgentCatalog`:
  `agents[]` (id, name, description, use, policy, delegation, instructions, effort, ordered
  `models`, `builtin`, `source`, `digest`, `forConversation`, `editable`), Core's `limits`, the
  global path and the digest a save must send back, plus the import record.
- `SaveAgent(globalDigest, entry)` creates a custom agent (empty id) or updates one, and writes the
  global `lumencortex.json` through `config.Save` with the digest that was read, like
  `SaveConcurrency`. A built-in accepts only `instructions`, `effort` and `models`; its name,
  description, use and ceilings are refused if they differ. An empty override removes the entry.
- `DeleteAgent(globalDigest, id)` removes a custom agent; built-ins are refused.
- Both refuse a workspace-sourced definition (`ErrWorkspaceAgent`): the page writes the global file.
- A stale digest is `config.ErrConflict` and an invalid agent is refused by Core's `Validate`;
  neither writes anything.

Wails surface: `GetAgents`, `SaveAgent`, `DeleteAgent`, `MigrateSubagentModel` in `app.go`, typed in
`frontend/src/lib/bridge.ts` (`AppAPI` + `bridge`), and `frontend/wailsjs` regenerated with
`wails generate module`.

### One-time import of the retired `agents.json`

Read on the first `Agents()` call, in the same mutex as the saves:

- custom profile → custom agent: id derived from the name (`^[a-z][a-z0-9-]{0,39}$`, numeric suffix
  on collision), name, description, instructions; `base: ask` → policy `read-only` + delegation
  `none`, `base: agent` → no ceilings; `modelRef` + `effort` → one `models` entry, only when the
  model is in the merged catalog **and** calls tools, otherwise dropped with a warning;
- the legacy `policy` default is dropped (ADR-0009 D6);
- built-in Ask/Agent edits → overrides of `ask`/`agent` (instructions, effort, models only);
- names colliding case-insensitively get a ` (2)` suffix; entries beyond `MaxCustomAgents` are
  reported, not lost;
- one `config.Save` writes the catalog, then `agents.json` is renamed to `agents.json.imported`
  (never deleted; a second backup gets `.2`, …) and the outcome is recorded in `agents.import.json`;
- a corrupt or non-v1 file is left untouched with a warning; a second read imports nothing and
  reports the recorded outcome. The Agents page shows the import report (file, imported count,
  skipped count, warnings).

### `subagentModel` retired

- `ConfigState.subagentModel` removed (Go DTO, `types.ts`); no Settings UI edited it.
- `MigrateSubagentModel()` calls `config.MigrateSubagentModel` on the global file and, when a
  workspace is open, on its `lumencortex.json`, and reports which files changed.
- `config.ErrSubagentModelRetired` is mapped through `core-errors.json` / `core-errors.ts` /
  `error-presentation.ts`; `errorRecoveryKind` returns `migrate`, so the error toast offers
  "Migrate configuration", which calls the bridge and reloads the configuration.

### Runs name an agent

- `AgentConfig` carries `agent` (catalog id) instead of `profileId`; `mode` is gone, as are
  `validMode`, `ErrInvalidMode` and the Desktop-side Ask capping.
- `agentOptionsFor(cfg, toolDenylist, input)` passes `Agent`, `ModelRef`, `Effort`, the user's
  `Policy` and `Delegation`, and `Interactive: true`; it sends no instructions and caps nothing.
  Core applies the agent's instructions and ceilings (ADR-0009: ask and agent differ only by
  ceiling, so the separate mode disappears).
- `SessionInfo.Agent` is exposed as `Session.agent`; `ErrUnknownAgent` and
  `ErrAgentNotForConversation` map to copy that tells the user to pick an agent.
- `checkReferences` now refuses a provider edit that would orphan an agent's model list in either
  file (Core would refuse to load it).

### Frontend

- `app/agent-profiles.ts` → `app/agent-catalog.ts`; `app/hooks/useAgentProfiles.ts` →
  `app/hooks/useAgentCatalog.ts` (catalog, selection, thread pin adoption, save/delete with the
  read digest, import result).
- `components/agents/AgentsPage.tsx` + `AgentEditor.tsx` (replacing `AgentProfileEditor.tsx`):
  built-ins first with a badge and fixed fields read-only; editor for name, description, use,
  policy/delegation ceilings, instructions with a 16 KiB byte counter, effort, and an ordered model
  list (add/remove/reorder, per-entry effort, ≤8); workspace definitions read-only; the import
  report; the dirty-editor guard and delete confirm are kept.
- Composer: the agent selector lists conversation-eligible agents and shows the thread's pinned
  agent; picking one sends `agent` and no model (Core re-pins to the agent's first model), and the
  model picker sends a model only on an explicit pick. The Ask/Agent switch is removed. The
  Permissions and Delegation chips show what Core will run, min(grant, the selected agent's
  ceiling) (`agent-catalog.ts` `underCeiling`): levels above the ceiling are not offered, and a
  ceiling that leaves one value (e.g. `ask`) disables the chip with `agentCapsControls` as the
  reason. The stored grant is untouched, so an agent without a ceiling restores it.
- `agent-config.ts` (`buildAgentConfig` without mode/profileId), `composer-preferences.ts` (no
  `mode`), `types.ts` (agent DTOs), i18n zh-CN + en, visual fixtures (`visual/fixture-data.ts`) on
  Core's catalog with four built-ins plus one custom agent.

## Migration behaviour

| Case | Result |
|---|---|
| `agents.json` present, valid v1 | imported once; renamed to `agents.json.imported`; report in the Agents page |
| `agents.json` corrupt / not v1 | left byte-for-byte; warning in the page; catalog loads |
| profile model not in the catalog, or not tool-calling | model dropped with a warning; the agent inherits the default list |
| instructions over 16 KiB | that profile is not imported and is reported (it stays in the backup) |
| more than 16 custom agents | the first 16 are imported; the rest are reported and stay in the backup |
| second read | no import; the recorded outcome is reported (`alreadyImported`) |
| file still sets `subagentModel` | load fails with `ErrSubagentModelRetired`; the toast offers one-click Migrate |
| save with a stale digest | `config.ErrConflict`, nothing written |
| built-in fixed field sent differently | refused (`ErrBuiltinAgent`), nothing written |

## Files

Backend: `internal/backend/agents.go` (new), `internal/backend/agents_test.go` (new),
`internal/backend/agent_profiles.go` (deleted), `agent_profiles_test.go` and `agent_mode_test.go`
(deleted), `internal/backend/runtime.go`, `internal/backend/config.go`,
`internal/backend/config_test.go`, `internal/backend/models_test.go`, `app.go`,
`docs/lumencortex.schema.json` (copied from Core at `8998c25`).

Frontend: `src/types.ts`, `src/lib/bridge.ts`, `src/lib/core-errors.json`, `src/lib/core-errors.ts`,
`src/lib/error-presentation.ts`, `src/lib/i18n/app-copy.ts`, `src/app/agent-catalog.ts` (new),
`src/app/hooks/useAgentCatalog.ts` (new), `src/app/agent-config.ts`,
`src/app/composer-preferences.ts`, `src/app/error-recovery.ts`, `src/app/useWorkspaceCommands.ts`,
`src/app/hooks/useWorkspaceController.ts`, `src/app/App.tsx`, `src/app/WorkspaceView.tsx`,
`src/app/WorkspaceRouteContent.tsx`, `src/app/ThreadTasksLayer.tsx`,
`src/components/agents/{AgentsPage,AgentEditor}.tsx`, `src/components/agents/agents.css`,
`src/components/composer/{Composer,NewTaskComposer}.tsx`,
`src/components/thread/{ThreadComposer,ThreadWorkspace,DelegationControl}.tsx`,
`src/components/inspector/TaskStatePanel.tsx`, `src/components/primitives/icons.ts`,
`src/visual/fixture-data.ts`, `src/app/agent-profiles.ts` and
`src/app/hooks/useAgentProfiles.ts` (deleted), `src/components/agents/AgentProfileEditor.tsx`
(deleted).

Tests: `src/app/hooks/useAgentCatalog.test.ts`, `src/components/agents/AgentsPage.test.tsx`,
`src/app/useWorkspaceCommands.test.tsx` (new); `src/app/agent-config.test.ts`,
`src/app/composer-preferences.test.ts`, `src/lib/error-presentation.test.ts`,
`src/components/composer/ComposerPickers.test.tsx`, `src/components/thread/ThreadComposer.test.tsx`,
`src/app/model-selection.test.ts` (updated).

Docs: `docs/architecture.md`, `docs/screen-specs.md`, `docs/interaction-spec.md`,
`docs/product-requirements.md`, `docs/lumencortex.schema.json`, this report.

## Verification actually run

- `go test -count=1 ./...` — pass (root, `internal/backend`).
- `go build ./...`, `go vet ./...` — pass.
- `npx tsc --noEmit` — pass.
- `npx vitest run` — 57 files, 260 tests, pass (incl. `app/agent-catalog.test.ts` for the
  ceiling rule and `ThreadComposer.test.tsx` for the capped chip).
- No `lint` script exists in `frontend/package.json`; the repo's checks are `tsc` (in `build`) and
  vitest.
- Visual smoke, Playwright over `visual.html` (real App, stub bridge, Chromium): 74 passed. The two
  specs that encoded the retired Ask base were rewritten: the `ask` ceiling caps and explains both
  chips and `agent` restores them; a custom read-only agent created on the Agents page is offered
  in the composer and its id reaches `StartAgent` as `agent`.

## Unverified / risks

- The Wails desktop binary was not launched natively in this pass; the smoke test runs the real App
  over the in-memory stub in Chromium.
- The import's sidecar `agents.import.json` is new state next to `lumencortex.json`. It is a record
  only; a deleted sidecar loses the report, not data (the backup remains).
- A legacy profile whose instructions exceed 16 KiB is not imported; that is reported, but the user
  must shorten it by hand.
- A workspace-defined agent is read-only in the page; editing the workspace file stays a manual act.
- The fallback notice is built from live events only. A thread reopened after a restart shows no
  "answered by" line for its earlier runs; the decision log in Core still records the failover.
- N3 (auth-error failover) is out of scope.

## Follow-up: fallback notice, child agents, Core A3 pin

Core is now pinned at `6935aa2` (ADR-0009 A3: `spawn_subagent`/`start_task` take an optional `agent`;
proposals record the agent and the proposing run's bounds). The pin was resolved from the local Core
checkout through a temporary `git url.insteadOf`, which was removed afterwards; Core must be pushed
before a clean module download works.

- `lib/model-fallback.ts` `currentFallback(events, sessionId)` reads Core's `provider.failover`
  (with `nextModelRef`) and `llm.complete` events of the thread's latest run (reset at
  `run.started`). `components/thread/ModelFallbackNotice.tsx` renders "Answered by B: A was
  unavailable, so the agent's model list moved on. The next turn starts with A again." in the
  thread's notice slot (`WorkspaceRouteContent.tsx`). Nothing is shown when the first model answered
  or when no candidate answered (the run's error shows instead). This covers A2 acceptance 7.
- `types.ts`: `SubagentNode.agent`, `ThreadTask.agent`, `TaskResult.agent`. `ExecutionTasks.tsx`
  shows the agent on each task card: the proposal's before a child exists, the child's pin after.
- New Core error marker `agentUseMismatch` ("agent cannot run this kind of child") with
  `errAgentUseMismatch` copy (zh-CN + en). It appears when a proposal's agent is no longer eligible
  at Start. `TestCoreErrorMarkersMatchCore` checks it against `lcx.ErrAgentUseMismatch`.
- Visual fixtures: the task scene's nodes and proposal run `worker`; `visualEvents` carry one
  fallback for the task thread.

Verification for this follow-up:
- `go build ./...`, `go vet ./...`, `go test -count=1 ./...` all pass.
- `npx tsc --noEmit` passes. `npx vitest run`: 58 files, 265 tests, pass. New:
  `ModelFallbackNotice.test.tsx` covers the fixture event render, another thread, a reset at the
  next run, no answer, and a chain.
- Playwright: 75 passed. New spec: "a run that fell back names the model that answered; task cards
  name their agent", which also checks that another thread shows no notice. A screenshot of the
  thread head was inspected; the notice sits under the config notice in the info tone.
