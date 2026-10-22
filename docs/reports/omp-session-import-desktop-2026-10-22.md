# OMP session import — Desktop UI

Status: **implemented and validated locally; committed to local Desktop `main`, not pushed.**
Desktop baseline `afd0c51`; Core pinned at `95478bd` by the agent-presets commit `69fb391`, then at `d2eaa01` (adds the retried-turn converter fix `099e155`) (through
a temporary `url.insteadOf`, `GOPROXY=direct GOPRIVATE=github.com/edynasty/*`, as in earlier
pins; no `replace`, no `go.work`). The commit holds only this change's hunks; other uncommitted
working-tree changes (sidebar runtime footer removal, context/SCM error handling) stay
uncommitted. The commit alone was verified in a separate worktree at `69fb391`: `go vet ./...`,
`go test -count=1 ./...`, `tsc --noEmit`, `npm test` (67 files / 327 tests), `npm run build` and
`npx playwright test` (88 passed).

- Core contract: ADR-0011, `LumenCortex-Core/docs/adr/0011-omp-session-import.md`,
  `runtime/omp_import.go` (`Engine.OMPSessions`, `PreviewOMPSession`, `ImportOMPSession`).
- Scope: Desktop only. Thin backend adapter, Wails bindings, typed bridge, TS types, the import
  sheet, localized copy, runtime-notice origins, backend/frontend/visual tests, visual fixtures.
- Non-goals: no Core change, no new source-directory picker (root is always OMP's default
  directory), no schema change, no change to the thread view's own semantics.

## What the UI does

- **Entry point.** A second sidebar row, "Import from OMP" / "从 OMP 导入", directly under
  "New thread" in the Threads page (`ThreadsSidebar`). It is the conventional spot: it sits where
  threads are created and listed.
- **Sheet.** `OmpImportDialog` (window-level `Modal`, so it is sized by the window container):
  - list of OMP sessions, **this workspace by default**, with a "This workspace / All workspaces"
    segmented control and a search box (Core does the filtering; the query is deferred);
  - each row shows title (id when the title slot is empty), cwd, relative update time, size and
    subagent count, plus an "Imported" badge and a "Source changed" badge when Core reports one;
  - the list is bounded to 100 (Core's default, max 500) and says so when it is full;
  - selecting a session loads Core's preview: goal, model, first user / last assistant excerpts,
    counts (messages, tool calls, subagent sessions, compactions, image placeholders, thinking
    blocks left out, hidden notices left out, calls marked interrupted; off-branch records,
    malformed records and skipped subagents only when non-zero), Core's warnings localized by code
    (unknown codes fall back to Core's English message), and the explicit statement: hidden
    reasoning is not imported, history tool calls are never re-run, the OMP file is not modified,
    a task OMP is still running is not taken over;
  - the statement lives in the sheet footer next to the primary action so it is visible without
    scrolling the preview;
  - primary action is disabled while importing; a session imported before shows **Open** and opens
    the existing native session without calling import again;
  - errors (list, preview, import) are shown inline in the sheet.
- **After import.** The sheet closes, the workspace state is re-read (Core wrote sessions this app
  did not create) and the imported root session is selected, so the native thread view shows it.
  A project switch closes the sheet.
- **Thread view.** `runtime-notice.ts` now maps the imported origins: `imported` → "History
  imported from another runtime" / "从其他运行时导入的历史", `imported_notice` → "OMP notice" /
  "OMP 通知" (body keeps its own `[OMP <type>]` label, nothing stripped), `imported_marker` →
  "OMP session event" / "OMP 会话事件". The bodies are the stored content.

## Backend adapter

`internal/backend/omp_import.go` — thin, like the sessions/agents adapters: type aliases onto
Core's types (no DTO translation where the wire shape already matches) and three methods that
forward to the open engine, returning `ErrNoWorkspace` when none is open. `app.go` binds:

| Wails API | Backend | Root |
|---|---|---|
| `ListOMPSessions(opts OMPListOptions)` | `Runtime.ListOMPSessions` | `""` (OMP default dir) |
| `PreviewOMPSession(path)` | `Runtime.PreviewOMPSession` | `""` |
| `ImportOMPSession(path)` | `Runtime.ImportOMPSession` | `""` |

The UI never chooses the source directory; `root` exists only for tests.

## Files

Created:

- `internal/backend/omp_import.go`
- `internal/backend/omp_import_test.go`
- `internal/backend/testdata/omp/sessions/…` — Core's fixture copied byte-for-byte from
  `LumenCortex-Core/internal/ompsession/testdata/sessions` (8 files, including the subagent tree,
  the tombstone, the advisor transcript, the lock sidecar and the artifact).
- `frontend/src/app/hooks/useOmpImport.ts` — list/preview/import state, stale-response guards.
- `frontend/src/lib/omp-import.ts` — list bound, title fallback, warning-code mapping, byte size,
  stat rows.
- `frontend/src/components/omp/OmpImportDialog.tsx`
- `frontend/src/components/omp/OmpSessionList.tsx`
- `frontend/src/components/omp/OmpImportPreviewPane.tsx`
- `frontend/src/components/omp/omp-import.css`
- `frontend/src/components/omp/OmpImportDialog.test.tsx`
- `frontend/src/lib/runtime-notice.test.ts`
- `docs/reports/omp-session-import-desktop-2026-10-22.md` (this file)

Modified (my hunks only):

- `app.go` — the three bindings, inserted between `SaveToolPermissions` and `GetAgents`.
- `internal/backend/…` — no other file.
- `frontend/src/types.ts` — `OMPListOptions`, `OMPImportRef`, `OMPSessionSummary`,
  `OMPImportStats`, `OMPWarning`, `OMPChildPreview`, `OMPImportPreview`, `OMPImportResult`
  appended at the end.
- `frontend/src/lib/bridge.ts` — three type imports, three `AppAPI` members, three `bridge`
  methods (`ompSessions`, `previewOMPSession`, `importOMPSession`).
- `frontend/src/lib/runtime-notice.ts` — `RuntimeNoticeCopy` keys and the three cases.
- `frontend/src/lib/i18n/app-copy.ts` — three origin keys and the `omp*` block, zh-CN and en.
- `frontend/src/app/presentation-model.ts` — passes the three new origin labels through
  `threadWorkspaceLabels`.
- `frontend/src/components/thread/ThreadWorkspace.tsx` — three label fields on its `labels` type.
- `frontend/src/components/thread/MessageItem.test.tsx` — label fixture + one rendering case.
- `frontend/src/components/sidebar/ThreadsSidebar.tsx` — `onImportOmp` prop and the row.
- `frontend/src/app/WorkspaceChrome.tsx` — `onImportOmp` prop; passes it to the sidebar after
  closing the compact drawer.
- `frontend/src/app/WorkspaceView.tsx` — `ompImport` prop, dialog in the overlays.
- `frontend/src/App.tsx` — one hook call, one prop. `useOmpImportSheet` is exported from
  `useWorkspaceController.ts` so App's import line merges with the existing one (App is at the
  350-line architecture bound; the hook body lives in its own module region).
- `frontend/src/app/hooks/useWorkspaceController.ts` — appended `useOmpImportSheet` and the
  `OmpImportSheet` type (open state, project-switch close, post-import re-read + navigation).
- `frontend/src/visual/fixture-data.ts` — three OMP sessions (this workspace, another workspace,
  one already imported with a changed source) and `visualOMPPreview`.
- `frontend/src/visual/app-stub.ts` — `ListOMPSessions`, `PreviewOMPSession`, `ImportOMPSession`
  (the import adds a native session and its transcript, including the final `imported` notice);
  a seeded "Migration notes" thread whose transcript ends with an `imported_notice` and an
  `imported` row, so Open has a real thread to show.
- `frontend/visual-tests/app.spec.ts` — a new `OMP session import` describe with two tests.

Not touched by this change: `go.mod`, `go.sum` (pinned in `69fb391`), Core. Pre-existing working-tree changes by other agents
(`WorkspaceChrome`'s `runtimeState`/`activeRuns` removal, `App.tsx`'s `activeRuns` removal,
context/scm/sidebar/app-shell changes, the agent-presets change) were preserved; none of my hunks
rewrite them.

## Tests

Backend (`internal/backend/omp_import_test.go`), on a temp `PI_CODING_AGENT_DIR`:

- `TestListOMPSessionsFiltersByWorkspace` — default list is this workspace only (title, cwd, size,
  two direct subagents, not imported); `All` returns both sessions newest-first; query matches
  title; `Limit` bounds.
- `TestPreviewOMPSessionWritesNothing` — preview reports goal, 3 children, 1 off-branch record,
  thinking blocks/images/compactions; the source file is byte-identical and no session was written.
- `TestImportOMPSessionIsIdempotent` — first import writes 4 sessions and returns the root id; the
  list reports the import; the second import returns `alreadyImported` with nothing written; the
  workspace holds exactly 4 sessions.
- `TestListOMPSessionsWithoutOMPDirectory` — missing OMP dir is an empty list, not an error.
- `TestOMPSessionsRequireWorkspace` — all three calls return `ErrNoWorkspace` without a workspace.

The fixture is copied into a temp agent dir; the test rewrites only the header `cwd` (and, for the
second session, the header `id` and the title slot) so the filter has one match and one miss. The
committed testdata keeps Core's content unchanged.

Frontend unit tests: `OmpImportDialog.test.tsx` (list → preview → import → `onImported`; an
already-imported session shows Open and never calls import; warning codes localized with an
English fallback for an unknown code; scope switch and search reach Core with `all`/`query`;
list failure shown inline), `runtime-notice.test.ts` (all imported origins, notice body kept, raw
fallback), and one `MessageItem` case proving `imported_notice` renders as a notice line, not a
user bubble.

Visual harness: the dialog opens from the sidebar, lists only this workspace, shows the imported
badge; Open closes the sheet and shows the existing imported thread with its `imported_notice` and
`imported` rows; reopening the sheet, choosing another session renders the preview and the safety
statement, and Import closes the sheet and shows the imported thread; a second test repeats the
sheet at 560px.

## Validation actually run

| Check | Result |
|---|---|
| `go test -count=1 ./...` (Desktop) | `ok ... 0.706s`, `ok .../internal/backend 19.365s` |
| `go vet ./...` (Desktop) | clean |
| `gofmt -l app.go internal/backend/omp_import.go internal/backend/omp_import_test.go` | clean (pre-existing unformatted files in the package were left alone) |
| `cd frontend && npx tsc --noEmit` | clean |
| `cd frontend && npm test` | 67 files, 331 tests passed |
| `cd frontend && npm run build` | built (`dist/`, pre-existing chunk-size warning) |
| `cd frontend && npx playwright test` (visual harness) | 88 passed, including the two new OMP tests |

Visual evidence captured from the harness at `/tmp/omp-dialog-1440.png` and
`/tmp/omp-dialog-560.png` (not committed): the sheet opens, lists sessions, shows the preview and
the footer statement, and at 560px stacks the list above the preview with the action row wrapping.

## Limits and open risks

- **`childMode: "imported"` has no label surface today.** `session-ui.ts` computes `childMode`
  (Core sets `subagent.mode = "imported"` on imported children), but no component renders mode
  labels — consumers only read `title`, `parentSessionId` and `delegation`. No label was added
  because there is nowhere to render it; a future surface that shows child modes should map
  `imported` to a localized label.
- Imported children appear in the inspector's subagent tree by their Core goal (`Scout1 (scout)`);
  their mode is not shown there.
- The visual harness proves the flow over the in-memory stub, not over a real OMP directory. The
  real path is covered by the backend tests against a real-format fixture; no native Wails run
  was done in this change.
- The backend tests rewrite the header of the temp fixture copy (cwd/id/title); the committed
  testdata is unchanged. A test that needs a second workspace's session would otherwise need a
  second fixture.
- No pagination beyond Core's 100/500 bound: a very large OMP history relies on the search to
  narrow the list (the sheet says so).
- Pre-existing, unrelated: `frontend/test-results/`, `frontend/wailsjs/`, `frontend/package.json.md5`,
  `build/darwin/Info*.plist` and the deleted `frontend/dist/.keep` are still untracked/modified in
  the working tree; none were staged by this change.

## Plugin platform cutover (ADR-0012) — supersedes the OMP-specific surface above

Core `9581de1` replaced the OMP-specific import API with its plugin platform (ADR-0012, D5 and D8):
an import source is a plugin capability, and every import call names the source. Desktop's
`go.mod` is pinned to that commit; the OMP-only `lcx.OMP*` types and `Engine.OMPSessions` /
`PreviewOMPSession` / `ImportOMPSession` no longer exist, so this section replaces the adapter
described above. The UI behaviour with one source (today: `omp`) is unchanged.

### Backend adapter

`internal/backend/session_import.go` (replaces `omp_import.go`) — the same thin forwarding, now
generic and always against the source's default directory (`root ""`), with `ErrNoWorkspace` when
no workspace is open:

| Wails API | Backend | Core |
|---|---|---|
| `ImportSources()` | `Runtime.ImportSources` | `Engine.ImportSources()` |
| `ListImportSessions(source, opts)` | `Runtime.ListImportSessions` | `Engine.ListImportSessions(ctx, source, opts)` |
| `PreviewImport(source, path)` | `Runtime.PreviewImport` | `Engine.PreviewImport(ctx, source, "", path)` |
| `ImportSession(source, path)` | `Runtime.ImportSession` | `Engine.ImportSession(ctx, source, "", path)` |
| `Plugins()` | `Runtime.Plugins` | `Engine.Plugins()` |
| `SetPluginEnabled(id, enabled)` | `Runtime.SetPluginEnabled` | `Engine.SetPluginEnabled(ctx, id, enabled)` |

The type aliases (`ImportSource`, `ImportSessionSummary`, `ImportPreview`, `ImportResult`,
`ImportStats`, `ImportWarning`, `ImportRef`, `ImportChildPreview`, `ImportListOptions`,
`PluginCatalog`, `PluginInfo`) alias Core's types, so the wire shape is Core's.

### UI

- The sheet loads `ImportSources()` on open. One source behaves exactly as before; more than one
  adds a `DesktopSelect` source picker and the generic title/lede; none (plugin disabled or
  failed) replaces the list and preview with an empty state that names Settings → Plugins and
  offers a button that closes the sheet and opens that pane.
- Settings gained a **Plugins** pane (`components/settings/PluginsPane.tsx`): name, id, version,
  API version, capabilities, built-in badge, lifecycle state, import source, last error and
  failure count with the last failure time, `statePath`, and `stateError`; the switch calls
  `SetPluginEnabled` and re-reads the catalog, showing a refused change inline.
- Frontend wire types were renamed from `OMP*` to the generic `Import*` names, and the dialog's
  helpers (`IMPORT_LIST_LIMIT`, `ImportStatRow`) follow; the OMP-prefixed component/file names stay
  because the entry point and its copy are still OMP's.

### Tests

- `internal/backend/session_import_test.go` keeps the OMP coverage (workspace filter, preview
  writes nothing, idempotent import, missing source directory, require workspace) and adds
  `TestDisablingImportPluginRemovesItsSource`: the catalog lists the built-in `omp-import`
  (`running`, capability `session-import`, source `omp`); disabling it empties `ImportSources`,
  makes list and import return `lcx.ErrImportSourceNotFound`, and re-enabling restores the source.
- `frontend/src/components/omp/OmpImportDialog.test.tsx` now drives the generic bridge and covers
  the zero-source empty state and the multi-source selector.
- `frontend/src/components/settings/PluginsPane.test.tsx` covers list rendering, a failed plugin
  with its error and failure count, the toggle calling the bridge then re-reading, a refused
  toggle shown inline, `stateError`, and the empty catalog.

### Validation actually run (2026-10-22, this cutover)

| Check | Result |
|---|---|
| `go build ./...` | clean |
| `go vet ./...` | clean |
| `go test -count=1 ./...` | `ok` main 0.776s, `ok internal/backend` 19.107s |
| `cd frontend && npx tsc --noEmit` | clean |
| `cd frontend && npx vitest run` | 69 files, 343 tests passed (three consecutive full runs); one earlier run reported a single transient failure that did not reproduce and was not in the import/plugins suites |
| `cd frontend && npm run build` | built (pre-existing chunk-size warning) |
| `cd frontend && npx playwright test` | 88 passed |

Wails bindings were regenerated with `wails generate module` (v2.16.0); `frontend/wailsjs/` is
untracked generated output. `go.mod`/`go.sum` were not changed by this cutover.

### Limits

- The Plugins pane needs an open workspace, like the MCP/skills panes: Desktop has no Engine
  before a project opens, so there is no catalog to read. Enablement itself is global.
- The visual harness proves the flow over the in-memory stub (`visualPlugins` /
  `visualImportSources`); no native Wails run was done for this cutover.
