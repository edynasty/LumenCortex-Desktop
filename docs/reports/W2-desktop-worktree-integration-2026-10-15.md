# W2 - Desktop session worktree cleanup and session deletion

Status: **implemented and validated locally against Core `156fdff` through a `go.work`.** Commit is on branch `feat/w2-worktree-integration` (worktree `../LumenCortex-Desktop-W2`). **Blocked:** the Core pin waits for Core `1d9cc6b` + `156fdff` to be pushed (section 6).

## 1. Scope and baseline

- Desktop baseline: `12a717b` (M2.4). Core: `156fdff` = W1 `1d9cc6b` + W1 follow-up. Both Core commits are local only; `origin/main` is `38387cf`.
- Contract: Core [ADR-0005](../../../LumenCortex/docs/adr/0005-session-worktree-ownership-and-deletion.md), "Consequences": Desktop builds the remove/delete dialog on `InspectSessionWorktree` and removes its in-process guard. Product review: `../LumenCortex-architecture-audit/design/handoffs/product-architecture-review-2026-10-15.md` (W2 row).
- The owner's uncommitted work in `../LumenCortex-Desktop` (16 files, model picker placeholder etc.) was not touched; W2 lives in its own worktree. Overlapping files with that work: `WorkspaceChrome.tsx` (different hunks) and `app-copy.ts` (different keys).
- Not done (out of scope): M3.1 and later, the Demo.

## 2. Changes

| Area | Change | Files |
|---|---|---|
| Wails API | `InspectSessionWorktree(id) WorktreeInspection`; `RemoveSessionWorktree(id, WorktreeCleanup) WorktreeCleanupOutcome` (was `(id, force bool) error`); new `DeleteSession(id, WorktreeCleanup) DeleteSessionOutcome` | `app.go`, `internal/backend/worktree.go` |
| Refusals as data | A Core refusal (`ErrWorktreeDirty/Unapplied/Ignored/Ownership/Borrowed`, `ErrDiscardStale`, `ErrWorktreeBusy`, `ErrRunHeld`, `*DependentsError`) returns `{refusal: {code, message, inspection?, dependents?}}` instead of an error, carrying Core's fresh inspection. Other errors stay errors. | `internal/backend/worktree.go` |
| Guard removed | `ErrWorktreeActive`, the `supervisor.Active` / `HasActiveSubagents` checks in remove and apply, and `Runtime.HasActiveSubagents` (no caller left). Core's run lock and worktree lease are cross-process; the Desktop guard was in-process only and missed borrowers that outlive the parent run (W1 probe P5). | `internal/backend/worktree.go`, `internal/backend/subagents.go` |
| Choices | `worktreeCleanupChoices(inspection, mode)` offers only what Core's matrix can accept: default when nothing is at risk; keep-branch when not dirty; discard bound to the inspected `head` + `statusDigest`; borrower = detach; uncertain = retain only. | `frontend/src/lib/worktree-cleanup.ts` |
| Dialog | `WorktreeCleanupDialog` (remove or delete): shows branch/path, dirty files, unapplied commits, ignored files (truncation noted), missing/borrowed/uncertain state; on refusal it replaces the shown state with Core's and explains (stale, busy, running, dependents with reasons). Replaces the old "Clean / Force cleanup" dialog. | `frontend/src/components/worktree/*`, `frontend/src/app/WorkspaceOverlays.tsx` |
| Entry points | Topbar "Remove worktree" (was "Clean worktree") and a new thread-menu "Delete…" (disabled while the session runs here; Core decides for runs elsewhere). Desktop had no session deletion before. | `WorkspaceView.tsx`, `WorkspaceChrome.tsx`, sidebar chain, `ThreadRow.tsx`, `sidebar.css` |
| After success | State reloaded from Core; if the selected session or one of its deleted subagents was deleted, route goes to new task. | `useSessionMaintenanceActions.ts` |
| Errors | `ErrWorktreeBusy` added to the sentinel list (UI copy `errWorktreeBusy`), kept equal to Core by `TestFrontendCoreErrorMarkersMatchCoreSentinels`; it also covers busy Apply. | `core-errors.json/ts`, `error-presentation.ts`, `models_test.go` |
| Copy | zh-CN and en keys for both dialogs, choices, refusals and dependent reasons; old `cleanupWorktreeTitle/Body`, `forceCleanupWorktree` removed. | `app-copy.ts` |

## 3. Tests (added or changed)

- `internal/backend/worktree_cleanup_test.go` (real Git repos, real Core engine): clean remove; dirty refuses default and keep-branch, inspected discard removes; **stale discard refused with fresh inspection and the newer edit intact**; unapplied commits refuse, keep-branch keeps branch; ignored `.env` refuses default and survives; uncertain (branch switched) retained only; missing directory diagnosed (`ErrWorktreeMissing` on Start) and detachable; delete refusal keeps the session, inspected delete removes it.
- `TestBorrowerAndDependentsThroughDesktop` (fake HTTP provider spawning a read-only subagent): `runHeld` while the parent runs; after the parent ends and the child still runs, remove is `busy`, Apply returns `ErrWorktreeBusy`, delete lists the child as a `running` dependent; the borrower cannot discard (`borrowed`); after the child ends, deleting the parent deletes the child and the worktree.
- `worktree-cleanup.test.ts` (choice matrix), `WorktreeCleanupDialog.test.tsx` (no safe option over dirty files; stale refusal rebinds the next discard to the fresh digest; deletion reports deleted children; dependents listed), `useSessionMaintenanceActions.test.ts` (route reset only when the selected session was deleted), `error-presentation.test.ts` (busy).
- Migrated: `TestDesktopWorktreeRuntimeLifecycle` (was `force=true`, now inspected discard).

## 4. Validation (run on darwin/arm64, Go 1.25, Node 24)

| Check | Result |
|---|---|
| `go test -count=1 ./...` | pass |
| `go build ./...`, `go vet ./...` | pass |
| `go test -race` on the worktree tests | pass |
| `npm run build` (tsc + vite) | pass |
| `npx vitest run` | 40 files, 132 tests pass |
| `npx playwright test` (visual suite) | 85 pass |
| Smoke: `wails dev` with real bindings, temp repo | see below |

Smoke, real app (`wails dev`, Chromium against the dev server, repo in `/tmp`):

1. Worktree session with `draft.txt` and ignored `.env` -> thread menu "删除…": dialog listed both; only "丢弃并删除" offered.
2. Added `newer.txt` after the dialog opened, clicked discard: refused with the "no longer in the state shown, nothing was deleted" message, `newer.txt` shown, all files still on disk.
3. Discard again: session gone, worktree directory and branch gone.
4. Session with one unapplied commit -> topbar "移除 Worktree": commit listed, "移除目录，保留分支" + discard offered; keep-branch left the session on local runtime and the branch with commit `47dae75`.

All smoke artifacts were removed.

## 5. Limits and unverified

- Only macOS built and run. The smoke used `wails dev` in a browser, not the packaged app window.
- `busy`/`runHeld`/`dependents` were verified through backend and component tests, not by clicking through a live concurrent run.
- `gofmt -l` flags `app.go` and `internal/backend/worktree.go` for blank lines that predate W2 (same as M2.4 report); W2 lines are formatted.
- The thread menu disables Delete only for runs in this process; a run in another process is refused by Core (`runHeld`) and explained in the dialog.

## 6. Blocker and next actions

1. **Owner:** push Core `1d9cc6b` and `156fdff`.
2. Then in the Desktop worktree: `go get github.com/edynasty/LumenCortex@156fdff && go mod tidy`, delete the local `go.work` (untracked, never committed), rerun section 4 Go checks, commit `build: pin core 156fdff (W1 worktree safety) (W2)` on top of the W2 commit, merge.
3. Then M3.1 per the review roadmap.
