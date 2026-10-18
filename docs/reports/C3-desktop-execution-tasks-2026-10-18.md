# C3 Desktop: delegation grant, execution tasks, subtree Stop (2026-10-18)

Status: **implemented and validated locally; not pushed.** Desktop `8f08b39` (code, tests, this report; this hash line is a follow-up commit), Core `aa12861` (pinned) plus Core docs commit recording C3 in ADR-0006. Paired with Core C2 ([Core C2 report](../../../LumenCortex/docs/reports/C2-execution-tasks-2026-10-18.md)) and ADR-0006 D2/D3/D4.

## Scope and baseline

- Desktop baseline `da19017` (C1, pinned Core `04f371c`).
- Core pin: `github.com/edynasty/LumenCortex v0.0.0-20261018061411-aa12861c3798` (Core `aa12861`, unpublished; resolved with the local `url.insteadOf` as in C1/M4.2). Core commits since the C2 report, all local:
  - `fd23e73` toolset schemas omit `required` instead of `null`; schema regression test; C2 live run (Part 1, recorded in the C2 report).
  - `241fdb5` test: execution children and read-only subagents share the per-parent limit of four (C2 decision 5).
  - `a0dd4c1` fix: a running or gated execution child is the parent's `tasks` obligation; a failed/interrupted child blocks the evidence latch (C2 correction, recorded in the C2 report).
  - `aa12861` `SessionUIPatch.Delegation`: stores the thread's grant in the host `ui` key (presentation state; the Start's `AgentOptions.Delegation` remains what Core enforces).
- Not in scope, not started: M5.1, C4, Governor, Context Graph; auto-Start of the parent when a child finishes (ADR D4 "may", host-owned); applying a child's changes to the parent workspace.

## Implemented behaviour

| Area | Behaviour | Code |
|---|---|---|
| Grant | Composer control `None` / `Propose` / `Isolated`, default `None`. Stored per thread through `UpdateSessionUI({delegation})` (Core validates); sent as `AgentConfig.delegation` with every Start/Continue. The menu states "Applies from the next turn. Tasks already started keep their authority." A child thread shows "Fixed task authority" and has no control. | `components/thread/DelegationControl.tsx`, `app/agent-config.ts`, `App.tsx`, `internal/backend/runtime.go` |
| Proposals | A Task State task in state `proposed` is a card "Awaiting your start" with objective and Start. Start calls `StartProposedTask`; the card changes only after Task State and SubagentTree are re-read from Core. Start is disabled while the parent runs (here or elsewhere) because Core refuses it under the run lock; double clicks are suppressed per task. Core errors (not found, already started, no commit, child limit, run held) map to copy through `core-errors.json`. | `components/thread/ExecutionTasks.tsx`, `app/hooks/useThreadTasks.ts`, `lib/core-errors.*` |
| Task cards | Phase from Task State (`proposed`/`started`) and the child's SubagentTree node: `starting`, `running`, `running_elsewhere` (durably running, not active in this process), `waiting_gate` (with "has not finished" hint), `interrupted`, `failed`, `finished · review` (a completed run is never shown as a done objective), `unknown`. Facts from the newest `task_result` whose status matches the node's current status: checks (passed/failed/not verified/none/unreadable), unapplied commits, uncommitted files, open units, missing worktree, error. Branch with worktree path tooltip; Open navigates to the child thread. | `lib/execution-tasks.ts`, `components/thread/ExecutionTasks.tsx` |
| `task_result` rows | Rendered as runtime rows "Task result" with objective, status, facts, final answer (clamped) and an Open action; tinted for `failed`/`interrupted`/`waiting_gate`. Parsed from Core's row (header line + JSON); no copy is stored. | `components/thread/TaskResultNotice.tsx`, `lib/execution-tasks.ts` |
| Stop | The composer Stop and each card's Stop call `CancelSubtree`. `CancelAgent` is removed (backend, app binding, bridge) because it left a parent's tasks running. "Stop all" appears in the task header when more than one task runs here and the parent is idle. Runs held by another process are reported ("N run in another process and cannot be stopped here") instead of being shown stopped. | `app/hooks/useAgentActions.ts`, `app/hooks/useThreadTasks.ts`, `app.go` |
| Run vs resolution | Run status `completed` is now labelled "Turn ended" (sidebar and header; subagent "Run finished"). Beside it a resolution pill from Task State: Open / Ready for review / Done / Dropped. The final-answer panel is green only when the resolution is Done. | `ThreadWorkspace.tsx`, `ThreadTasksLayer.tsx`, `tasks.css`, `app-copy.ts` |
| Refresh | Task State is read on runtime events and after every action; SubagentTree and transcript through the existing thread refresh. Nothing about tasks is persisted in the frontend. | `useTaskState.ts` (`refresh` exposed), `useThreadTasks.ts` |

Desktop holds no authority rules: the grant is the user's choice passed through; child authority, the run lock, the per-parent limit and delivery are Core's.

## Changes

New: `app/ThreadTasksLayer.tsx`, `app/hooks/useThreadTasks.ts`, `components/thread/{DelegationControl,ExecutionTasks,TaskResultNotice}.tsx`, `components/thread/tasks.css`, `lib/execution-tasks.ts` (+ test), `internal/backend/tasks.go` (+ test), `visual/task-fixture.ts`, `visual-tests/tasks.spec.ts`.
Modified: bridge/types/copy/error mapping, `ThreadWorkspace`, `ThreadComposer`, `WorkspaceRouteContent` (thread labels moved to `presentation-model.threadWorkspaceLabels` to stay under the 350-line component rule), `App.tsx`, `useAgentActions`, `useSessionMaintenanceActions` (shared `SessionUIPatch`), `session-ui`, visual fixtures, backend tests that used `CancelAgent`, `go.mod`/`go.sum`.

## Validation (all run 2026-10-18)

| Suite | Result |
|---|---|
| `go build ./... && go vet ./... && go test -count=1 ./...` (Desktop) | pass; includes `TestDelegationGrantProposalStartAndDelivery`, `TestCancelSubtreeStopsARunningTask` (real engine, SQLite, git, scripted provider) |
| `tsc --noEmit` | pass |
| Vitest | 42 files, 157 tests pass |
| Playwright (full) | 104 pass, incl. `tasks.spec.ts`: every phase at 1440/1180/820/560 with overflow bounds, Start→running only after the stub's Core state changes, card Stop → interrupted, grant menu, dark theme |
| `wails build -platform darwin/arm64 -clean` | `build/bin/LumenCortex Desktop.app` built and self-signed against Core `aa12861`; generated bindings contain `CancelSubtree`, `StartProposedTask`, `UpdateSessionUI`, no `CancelAgent` |
| Core (at `aa12861`) | `go test -count=1 ./...`, build, vet pass (run with each Core commit) |

### Real application, real model (not mocked)

`wails dev` (real Go backend + Core) with an isolated `XDG_CONFIG_HOME`, provider `local/deepseek-v4.1-flash` (key from env, never written), one required check `greeting` (`grep -q 'hello from task' notes.txt`), fresh git workspace. Driven through the React UI in Chromium by a throwaway script (not committed).

| Step | Observed |
|---|---|
| Turn 1, grant None | turn ended; header "Turn ended" + resolution "Open"; stored grant absent (default); no tasks; the model reported it has no `start_task` |
| Grant → Propose, turn 2 | stored `propose`; one card "Awaiting your start" with the model's objective; Core Task State `t1 proposed`; no child |
| Start on the card | card left `proposed` only after Core reported it; duplicate `StartProposedTask` → "execution task proposal was already started"; unknown id → "execution task proposal not found" |
| Child finished | card "Finished · review"; child `completed`; worktree `notes.txt` = `first line\nhello from task\n`; main checkout unchanged; parent resolution `open` |
| Turn 3 | one `task_result` row (Finished · review, Checks passed, 1 uncommitted file); parent stays `open` with obligation `checks` (change only in the child's worktree; D2 rule) |
| Turn 4 | still one row (no redelivery) |
| Grant → Isolated, turn 5 | model called `start_task`; card Running; card Stop → `interrupted`; other task unaffected; parent turn ended normally |
| App restarted | thread rebuilt from Core: Turn ended, Open, grant Isolated, phases interrupted + finished, 1 result row |
| Next Start after restart | `interrupted` transition delivered once (2 rows total); one more turn: still 2 |

### Visual acceptance

Inspected fixture screenshots at 1440/1180/820/560 (light and dark) and real-app screenshots at 1440/820/560. Fixed during inspection: grant control hidden at 560 by the existing composer rule; composer row overflowing so the model and policy labels were cut (the keyboard hint is dropped when the grant is shown); grant menu options truncated; result-row Open button invisible (now the icon convention of message head actions); "0 changed files" noise (zero counts omitted); model picker squeezed to one letter at 560 (badge and limits dropped there). No horizontal overflow at any width.

## Decisions (implementation-level, for owner review)

1. Composer Stop is subtree Stop; `CancelAgent` removed. A parent-only Stop has no use case once tasks outlive the turn.
2. Run status `completed` is labelled "Turn ended" everywhere; the resolution pill carries objective state. No new status concept.
3. The grant control sits in the composer footer (it applies to the next turn), not in the Inspector.
4. "Stop all" is shown only with more than one task running here and the parent idle; while the parent runs, the composer Stop already covers the subtree.

## Limits and risks

- The packaged `.app` was built but driven only through `wails dev` (same Go backend and frontend, browser-hosted webview); no native-window automation. Visual checks are screenshots in Chromium, not WKWebView.
- `running_elsewhere` and the "cannot be stopped here" notice are covered by unit and fixture tests, not by a real two-process run.
- `waiting_gate` children were not produced by the live model; covered by Core tests and fixtures.
- Errors in `task_result` are shown as Core wrote them (e.g. "context canceled" after Stop).
- `/wails/ipc.js` (Wails browser-mode runtime) throws one `reading 'nodes'` error at page load in `wails dev`; it is Wails code, not app code, and has no visible effect.

## Next: M5.1 handoff

M5.1 (Runtime Cleanup) may start once C3 is accepted. Dependencies from this item: Desktop pins Core `aa12861`; the public surfaces Desktop now relies on are `StartProposedTask`, `CancelSubtree`, `SessionUIPatch.Delegation`, `AgentOptions.Delegation`, `SubagentNode.Kind`, `protocol.OriginTaskResult`/`TaskResultHeader` and the `TaskResult` JSON. Any M5.1 change to these is a paired Desktop change.
