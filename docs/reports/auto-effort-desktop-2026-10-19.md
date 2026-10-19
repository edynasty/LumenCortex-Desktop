# Desktop: Auto reasoning effort in the composer (2026-10-19)

Core: `4615933` (`feat(runtime): auto reasoning effort resolved once per turn by a judge model with
a heuristic fallback`). Desktop pinned it in `chore(deps): pin core 4615933 (auto effort)`.

## Pin commit

- `go.mod` / `go.sum`: `github.com/edynasty/LumenCortex` `003ebd838350` → `4615933886ab`, resolved
  through a temporary global `url.<core-checkout>.insteadOf https://github.com/edynasty/LumenCortex`
  (`GOPROXY=direct GOPRIVATE=github.com/edynasty/*`), removed afterwards. No `replace`, no `go.work`.
- `docs/lumencortex.schema.json`: copied byte-for-byte from Core's canonical schema. Core's
  `docs.ConfigSchema` is embedded, and `internal/backend/config_test.go` already fails when the two
  differ, so the copy is the only supported state. It now carries `effortRequest` (`… | "auto"`) and
  the `effort.auto` object (`model`, `max`, `timeoutSeconds`).
- `frontend/src/lib/core-errors.json`: Core's `ErrInvalidEffort` text gained `auto`. The marker file
  mirrors Core's sentinel strings and is checked by
  `TestFrontendCoreErrorMarkersMatchCoreSentinels`; the pin commit updates it so that commit is green
  on its own.

The pin commit therefore contains `go.mod`, `go.sum`, the schema copy and the Core error marker —
the schema and marker are direct consequences of the bump, not feature work.

## Feature: auto effort end to end

### Contract

- Core accepts `auto` as a **request value**, not a level: it classifies each user turn (judge model
  when `effort.auto.model` is configured, deterministic heuristic otherwise), caps the result at
  `effort.auto.max` (default `high`) and fits it to the candidate model's `reasoning.efforts`. It is
  never part of `EFFORT_ORDER`, never a per-model level.
- Desktop does not resolve anything. It sends `effort: "auto"` and Core decides once per Start.

### Backend (`internal/backend/runtime.go`)

- `AgentConfig.Effort` documents the accepted values, including `auto`.
- New `validEffort` guard in `startAgent`: `""`, the five levels and `auto` pass; anything else is
  refused with `lcx.ErrInvalidEffort` before any run starts (Core would refuse it too; the bridge now
  refuses first and writes nothing).
- `agentOptionsFor` still maps the value unchanged into `lcx.AgentOptions.Effort`.

### Frontend

- `types.ts`: `AgentEffort` gains `"auto"`.
- `model-selection.ts`: `AUTO_EFFORT` constant; `orderedEfforts` explicitly drops `auto` if a
  configuration lists it in `reasoning.efforts`; `supportedEffort` keeps `auto` when the model has
  any levels and returns `undefined` (nothing sent) when it has none.
- `Composer.tsx`: the effort menu now lists **Auto** between Default and the model's own levels, only
  when the model has levels. The row carries a Lucide `Sparkles` icon (`autoEffort`) and the
  description "Judged per turn by difficulty; uses heuristic rules unless effort.auto.model is
  configured" (zh: "按每轮难度自动判定；未配置 effort.auto.model 时使用启发式规则"). The collapsed
  chip shows `Auto` / `自动`. `MenuPicker` already provides the keyboard flow (Tab into the menu,
  arrows, Home/End, Enter, Esc returns focus to the chip).
- `composer-preferences.ts`: the effort whitelist accepts `auto`, so the choice survives a restart.
- `useComposerModelControls.ts`: a model switch keeps `auto` whenever the new model has levels and
  clears it for a model without any (the switch check now goes through `supportedEffort`).
- `app-copy.ts`: `effortAuto`, `effortAutoDescription` in both locales; `errInvalidEffort` mentions
  `auto`.
- No provider/settings UI was added; `effort.auto` is documented in the schema copy and in
  `docs/frontend-development-standard.md` §12.

## Tests

| Test | What it locks |
| --- | --- |
| `TestAutoEffortReachesCoreUnchanged` (backend) | `agentOptionsFor` passes `auto` (whitespace-trimmed) into `AgentOptions.Effort`; a real `StartAgent` with `auto` runs and reaches the provider once. |
| `TestRejectedStartsReportCoreSentinelsAndLeaveTheSessionUnpinned` (existing case) | an unknown effort string is still refused with `lcx.ErrInvalidEffort` and leaves the session unpinned. |
| `model-selection.test.ts` | `orderedEfforts` drops `auto`; `supportedEffort("auto", levels)` = `auto`, with `[]` = `undefined`. |
| `useComposerModelControls.test.tsx` (new) | switching to another model with levels keeps `auto`; a model without levels clears it; a concrete level the next model lacks still resets; `auto` survives a remount (preferences). |
| `composer-preferences.test.ts` | `auto` is a remembered value. |
| `visual-tests/app.spec.ts` | the effort menu lists 5 rows for GPT-5.6; the Auto row documents the heuristic; Tab + ArrowDown + Enter picks Auto; Resume sends `effort: "auto"` through the bridge (recorded in the page, stub bridge conventions). |

## Validation

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | pass |
| `npx vitest run` | 51 files, 229 tests pass |
| `npx playwright test` | 72 pass |
| `go vet . ./internal/backend` | pass |
| `go test -count=1 . ./internal/backend` | `internal/backend` pass; root `TestWireTypesMatchGoDTOs` fails on the parallel agent-profile work (`profileId` in Go, not yet in `types.ts`), not on this change |
| `npm run build` | blocked by the parallel agent-profile work (`AppAPI` gained profile methods, visual stub not yet updated) |
| `scripts/build-macos.sh` | blocked by the same in-flight sibling work at the time of writing |

The working tree also carries a later, parallel Core pin (`f7ffc18`, `AgentOptions.Instructions`) by
the agent-management work; `auto` is unchanged by that commit.
