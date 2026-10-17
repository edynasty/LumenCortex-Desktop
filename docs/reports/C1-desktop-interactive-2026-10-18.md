# C1 Desktop: conversation threads are interactive (2026-10-18)

Status: **implemented and validated locally; committed to local Desktop `main`, not pushed.** Paired with Core C1 ([Core report](../../../LumenCortex/docs/reports/C1-interactive-2026-10-18.md)).

## Scope

- ADR-0006 D3: "Desktop sets it for conversation threads." Every Desktop thread is a conversation, and Desktop never sends a host workflow, so `startAgent` (both `StartAgent` and `ContinueAgent`) starts runs with `Interactive: true`.
- Pin: `github.com/edynasty/LumenCortex v0.0.0-20261017225215-04f371cb8e29` (Core `04f371c`, unpublished). Resolved with a local `url.insteadOf`, as in M3.3/M4.2; no `replace`, no `go.work`.
- No frontend, Wails binding or copy change. Not in scope: C2 delegation, C3 proposals, task cards, subtree controls, status relabelling.

## Behaviour change seen by the user

| | Before C1 | After C1 |
|---|---|---|
| Thread with an open work unit; the agent answers | each answer rejected with a `completion_blocked` row; run ends `interrupted/max_steps` | turn ends `completed` with the answer; the unit stays open; the Task tab shows resolution open with the `work_units` obligation |
| Question turn with required checks configured | the gate ran the checks at every answer | no check runs; Checks tab unchanged |
| Turn in which the agent edited files | the gate ran the checks and blocked on a failure | checks decided once at the turn end; a failure shows in the Checks tab and keeps the `checks` obligation; a pass can latch the thread done |
| "Accept" in the Checks tab | latched at the next run end | unchanged |

## Changes

| File | Change |
|---|---|
| `internal/backend/runtime.go` | `Interactive: true` in `startAgent` |
| `internal/backend/interactive_test.go` | `TestConversationTurnEndsWithAnOpenWorkUnit` (new) |
| `internal/backend/checks_test.go` | `openChecksWorkspace` takes the provider handler. `TestCheckResultsPageAndArtifactsReadAsText` now makes its results through two turns that edit `README.md` with `write_file`, instead of relying on the gate deciding the check at each blocked answer. Its subject (paging, log and diff artifacts) is unchanged. |
| `go.mod`, `go.sum` | Core pin |

## Validation

| Check | Result |
|---|---|
| `go build ./...`, `go vet ./...`, `go test -count=1 ./...` | pass |
| `go test -v -timeout 90s ./internal/backend` | pass (46 top-level tests) |
| `npx tsc --noEmit`, `npx vitest run` (frontend unchanged) | pass; 41 files, 149 tests |
| `wails build -clean -platform darwin/universal` (temporary copy, to keep the owner's untracked `build/`) | built; `x86_64 arm64` |
| Mutation: `Interactive: false` | `TestConversationTurnEndsWithAnOpenWorkUnit` fails ("session interrupted … after 4 requests", the pre-C1 behaviour) and so does the paging test |

Not run: the packaged app against a live provider; Playwright (no frontend change).

## Risks

- **Status label:** the thread list shows the run status `completed`, which now means "turn ended", not "task done". Resolution is in the Task tab. Labelling threads by resolution belongs to C3.
- **Publication:** Desktop pins unpublished Core `04f371c`; publish Core first.
- **Pre-existing, not committed:** the working-tree deletion of `frontend/dist/.keep` and the untracked `.lumencortex/`, `build/`, `frontend/wailsjs/` and binary.
