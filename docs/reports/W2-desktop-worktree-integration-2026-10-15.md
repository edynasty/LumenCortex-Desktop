# W2 - Desktop session worktree cleanup and session deletion

Status: **implemented, published Core pinned, validated, integrated into local Desktop `main`.** `main` fast-forwarded `12a717b..5e810ab` (`8537300` feature, `39a4813` pin, `5e810ab` report), plus this report update. The owner's uncommitted work was restored exactly (section 6). Desktop `main` is not pushed.

## 1. Scope and baseline

- Desktop baseline: `12a717b` (M2.4). Core published: `origin/main` fast-forwarded `38387cf..9569e39` (`1d9cc6b` W1, `156fdff` W1 follow-up, `9569e39` report; no other commits, no force push).
- Pinned module: `github.com/edynasty/LumenCortex v0.0.0-20261015092833-156fdff946e4` (`go get …@156fdff && go mod tidy`; `go.mod` + `go.sum` only, commit `39a4813`). No `go.work`, no `replace`; `go mod verify` passes. `9569e39` is docs-only, so the pin stays on `156fdff`.
- Contract: Core [ADR-0005](../../../LumenCortex/docs/adr/0005-session-worktree-ownership-and-deletion.md), "Consequences": Desktop builds the remove/delete dialog on `InspectSessionWorktree` and removes its in-process guard. Product review: `../LumenCortex-architecture-audit/design/handoffs/product-architecture-review-2026-10-15.md` (W2 row).
- The owner's uncommitted work in `../LumenCortex-Desktop` (16 tracked changes, 20 untracked files including `internal/backend/zz_audit_probe_test.go`, the in-progress M2.4 audit report and `.lumencortex/lumencortex.db`) was preserved and remains uncommitted. Files touched by both: `WorkspaceChrome.tsx`, `app-copy.ts`, `VisualFixture.tsx`, all in different hunks.
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

## 4. Validation (darwin/arm64, Go 1.25, Node 24; against the published pin, `GOWORK=off`)

| Check | Result |
|---|---|
| `go test -count=1 ./...`; `go test -v -timeout 90s ./internal/backend` | pass |
| `go build ./...`, `go vet ./...` | pass |
| `go test -race` (worktree, borrower, run-held, continue tests) | pass |
| `npm install`, `npm run build` (tsc + vite) | pass |
| `npx vitest run` | 40 files, 132 tests pass |
| `npx playwright test` (visual suite) | 85 pass |
| `wails build -clean -platform darwin/universal` | built and self-signed `build/bin/LumenCortex Desktop.app`; `lipo -archs`: `x86_64 arm64` (`Not found: time.Time` from the binding generator is not an error) |
| Smoke: `wails dev` with real bindings, temp repo (run before the pin, against the same Core source through `go.work`) | see below |

Integration rehearsal: a clean temporary worktree at `39a4813` + the owner's exact tracked diff (`git apply --3way`: every hunk applied cleanly) + the owner's untracked probe test:

| Check | Result |
|---|---|
| `go test ./...`, `go build`, `go vet` (frontend built first; the owner's diff deletes the tracked `frontend/dist/.keep`, so `go:embed all:frontend/dist` needs a build) | pass, the owner's probe test included |
| `tsc --noEmit` | pass |
| `npx vitest run` | 135 pass, 1 fail: `useWorkspaceController.test.ts` › "never lets an older configuration response replace a newer one". It fails 3/3 times on `12a717b` + the owner's diff without W2, so it is the owner's work in progress, not a W2 regression; left untouched. |
| `npx playwright test` | 93 pass (the owner's new visual tests included) |

Both temporary worktrees were removed.

Smoke, real app (`wails dev`, Chromium against the dev server, repo in `/tmp`):

1. Worktree session with `draft.txt` and ignored `.env` -> thread menu "删除…": dialog listed both; only "丢弃并删除" offered.
2. Added `newer.txt` after the dialog opened, clicked discard: refused with the "no longer in the state shown, nothing was deleted" message, `newer.txt` shown, all files still on disk.
3. Discard again: session gone, worktree directory and branch gone.
4. Session with one unapplied commit -> topbar "移除 Worktree": commit listed, "移除目录，保留分支" + discard offered; keep-branch left the session on local runtime and the branch with commit `47dae75`.

All smoke artifacts were removed.

## 5. Limits and unverified

- Only macOS was built. The packaged universal app was built but not launched; the interactive smoke used `wails dev` in a browser.
- `busy`/`runHeld`/`dependents` were verified through backend and component tests, not by clicking through a live concurrent run.
- `gofmt -l` flags `app.go` and `internal/backend/worktree.go` for blank lines that predate W2 (same as M2.4 report); W2 lines are formatted.
- The thread menu disables Delete only for runs in this process; a run in another process is refused by Core (`runHeld`) and explained in the dialog.

## 6. Integration result

Owner-approved procedure (2026-10-15), run in `../LumenCortex-Desktop`:

1. Persistent backup of the owner's work, verified before any change: `~/.lumencortex-wip-backups/desktop-main-2026-10-15/` (`tracked.patch`, binary diff SHA-1 `f0798bc…` against `12a717b`; `untracked.tar`, 20 files; `files.sha256`, 35 files; `status.txt`). Replaying the patch on `12a717b` reproduced every modified file and the `.keep` deletion; the archive restored all 20 untracked files with matching SHA-256.
2. Rehearsed the exact procedure in a throwaway clone (a separate `refs/stash`): no conflicts, and the restored content was byte-identical.
3. `git stash push -m "W2 integration: owner WIP in WorkspaceChrome.tsx, app-copy.ts, VisualFixture.tsx (2026-10-15)" -- <those 3 files>` → stash `e833652`. The older stash `89aed55` ("pre-pull …") was left in place.
4. `git merge --ff-only feat/w2-worktree-integration`: `12a717b..5e810ab`.
5. `git stash apply e833652`: all three files merged automatically with no conflicts.
6. Verified before dropping the stash:
   - every tracked file equals the backup patch replayed on `5e810ab` (the same result as the rehearsal);
   - the 13 non-overlapping files and all 20 untracked files match the SHA-256 manifest;
   - the owner's added and removed lines in the three overlapping files equal the backup's;
   - every line W2 added to those files is present;
   - 16 modified, 20 untracked, nothing staged.
7. Dropped only `e833652` (matched by object ID). The stash list again holds only `89aed55`.

Validation on the integrated checkout (owner WIP + W2):

| Check | Result |
|---|---|
| `go test -count=1 ./...` (`-mod=readonly`), `go build ./...`, `go vet ./...` | pass, the owner's probe test included |
| `go test -race` (worktree, borrower, run-held, continue tests) | pass |
| `tsc --noEmit` | pass |
| `npx vitest run` | 135 pass, 1 fail: the owner's known WIP test (section 4), unchanged |

- The owner checkout has no `node_modules`, so `node_modules` from the W2 worktree was borrowed through a temporary symlink (W2 does not change `package.json` or `package-lock.json`). The symlink was removed after the run.
- Playwright and `npm run build` were not rerun in the owner checkout: they would overwrite the owner's untracked `frontend/test-results/.last-run.json` and the built `frontend/dist`. The identical tree passed both in the rehearsal (section 4).
- After the tests, the manifest and the three overlapping files were checked again: unchanged.

Cleanup: the W2 worktree and branch `feat/w2-worktree-integration` were removed after verification, and the temporary `/tmp/lcx-w2-owner-backup/` was deleted. The persistent backup is kept until the owner authorizes its removal.

Remaining (not W2):

- The owner's failing test "never lets an older configuration response replace a newer one" belongs to the unfinished M2.4 follow-up WIP; tracked there, not fixed here.
- Desktop `main` is ahead of `origin/main` (`e1d24bc`) by `12a717b` (M2.4) and the W2 commits; pushing is the owner's decision.
- Core `docs/reports/W1-worktree-safety-2026-10-15.md` still describes the Desktop pin as pending a push; correcting it needs a Core docs commit.
- Next: M3.1 per the review roadmap.
