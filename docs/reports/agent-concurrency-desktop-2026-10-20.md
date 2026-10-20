# Configurable agent concurrency — Desktop (2026-10-20)

Status: **implemented and validated locally** (Desktop). Core side: `LumenCortex/docs/reports/agent-concurrency-2026-10-20.md`, decision record Core ADR-0008.
Core pin: `efe9b66` (Desktop commit `af4fcf9`).

## Scope

Settings › General gains an **Agent concurrency** section editing Core's global `concurrency` object (`maxAgents`, `maxChildrenPerParent`). Core owns the values, bounds, defaults and enforcement; Desktop only reads `ConfigState.concurrency` and writes the global file through `config.Save` with the digest it last read.

## Changes

| Area | Change |
|---|---|
| Backend | `ConfigState.Concurrency{current, default, max}` from `Effective.Concurrency` and Core's bounds; `Runtime.SaveConcurrency(globalDigest, limits)` writes the global file only (stale digest → `config.ErrConflict`, out-of-bounds → Core's schema error; nothing written in either case); `App.SaveConcurrency` binding |
| Wire types | `ConfigState.concurrency`, `AgentConcurrency`, `ConcurrencyState` in `types.ts` (parity enforced by `TestWireTypesMatchGoDTOs`); `bridge.saveConcurrency`; visual stub/fixture |
| UI | `ConcurrencySection` in `SettingsPanes.tsx`: two number fields with Core's defaults as hints, typed text kept until blur then clamped to `[1, max]`, Save only when valid and changed, "Use defaults", conflict → reload and report. Hidden for the pre-load placeholder (bounds 0) |
| Errors | `agentLimit` marker (`runtime.ErrAgentLimitExceeded`) with localized actionable copy; `errChildLimit` no longer claims a fixed 4; both point to the setting |
| Warnings | `global_only` warning code rendered as "{key} in the project file is ignored …" |
| i18n | zh-CN and en for every new key |

## Tests run

| Command | Result |
|---|---|
| `go test -count=1 ./internal/backend -run 'SaveConcurrency\|PreservesUnmanaged\|ConfigState\|SchemaIdentity'` | 5 PASS (provider-catalog save now also proves `concurrency` survives) |
| `go vet ./... && go build ./... && go test -count=1 ./...` | all packages ok |
| `npx tsc --noEmit` | clean |
| `npx vitest run` | 53 files, 236 tests passed (new: `ConcurrencySection.test.tsx` ×4, `global_only` warning) |
| `vite build` | ok |

Smoke: the real App over the visual stub (`visual.html`, Chromium). Settings › General shows the section with values 4/3 and default hints, and both buttons stay disabled until a value changes. Typing `99` clamps to `16` on blur and enables Save. No console errors.

## Not verified

- A native Wails window was not launched. The visual stub's `SaveConcurrency` returns its fixture unchanged, so the end-to-end write is covered by the Go backend test against a real file, not by the UI smoke.
- The Playwright visual suite (`npm run visual:test`) was not run.

## Risks

- Lowering a limit never stops running agents (by Core design). Until running agents finish, the next start can be refused even though the UI shows the lower limit. The copy states this.
