# Agent profiles and the Agents page (2026-10-19)

## Design

- Core (`f7ffc18`): `runtime.AgentOptions.Instructions` (json `instructions,omitempty`), validated
  before the Start transaction (`runtime/instructions.go`): over 16 KiB or invalid UTF-8 is a typed
  `*InstructionsError` (`too_large` / `invalid_utf8`, wrapping sentinels). The loop appends it as the
  last system message after the default prompt and the skills prompt
  (`internal/agent/loop.go systemMessages`). The decision log gets one `instructions.appended` entry
  with SHA-256 and length only; the text is never persisted. Instructions cannot change policy,
  authority, permissions or the tool set: those are built before the loop and independent of it.
- Desktop: `internal/backend/agent_profiles.go` owns `agents.json` (`version: 1`) in the global
  configuration directory. Built-ins `ask` and `agent` always exist with fixed id/name/base; only
  instructions, description, model, effort and policy can change. Limits: 16 profiles, name 1–40
  characters and unique (case-insensitive), instructions ≤ 8000 characters, description ≤ 280,
  optional `provider/model`, effort none/low/medium/high/max/auto, policy read-only/workspace/full.
  Writes are temp+fsync+rename; a failed write leaves the previous file; a corrupt file falls back
  to the built-ins with a warning and is not overwritten until a save.
- Start: `AgentConfig.ProfileID` names a profile. The backend resolves its instructions and base from
  the store (the frontend never sends the text); `base: ask` forces read-only and no delegation,
  overriding `mode`, `policy` and `delegation`. Unknown ids are refused before Core runs.
- UI: rail item Agents (`⌘4`), page with the built-in list first and an editor (name, description,
  base, instructions with live counter and the appended-after-default note, default model/effort/
  policy, Save/Discard/Duplicate/Delete with inline confirm/Reset for built-ins, dirty guard on
  selection change). The composer's Ask/Agent switch became an agent selector over the same catalog;
  the selection is remembered by id and falls back to `agent` when missing. A profile's model/effort
  defaults are adopted when it is picked and remain changeable.

## Tests

- Core: `runtime/instructions_test.go` (order after the default prompt, next Start without
  instructions, digest-only evidence, read-only tools despite instructions, bounds and typed errors)
  and `internal/agent/loop_test.go` (skills then instructions). Full `go test ./...` passed.
- Desktop backend: `internal/backend/agent_profiles_test.go` (CRUD, built-ins immutable, validation
  and limits, atomic write and failed-write preservation, corrupt fallback, Start mapping with the
  Ask cap, unknown id).
- Frontend: vitest for route/preferences/composer selector plus the page flows; Playwright flows for
  the rail, editing a built-in, creating an Ask-based profile and asserting the Start config.

## Known gaps

- Playwright's dev server could not start in this environment (`vite` fails on `node:fs/promises`
  `constants` under the active Node 24.20), so the new visual flows and the required screenshots
  (`docs/reports/ux-provider-completion/agents-*.png`) are not produced here.
- Native accessibility proof was not run.
- The Desktop commit also carries the parallel Auto-effort hunks in shared files
  (`runtime.go`, `models_test.go`, `types.ts`, composer preferences), because they share those files.
