# Thread notes and "Remember" on Desktop (ADR-0010)

- **Date:** 2026-10-21
- **Scope:** the Desktop part of ADR-0010:
  - the Notes section in the Task pane (list, add as the user, remove);
  - "Remember" on a message (a user note);
  - the Context page's notes (list, freshness, Forget);
  - the Core pin.
- **Baseline:** Desktop `1714459` (pinned Core `6935aa2`).
- **Core:** pinned `3e4f418` (ADR-0010 B1/B2, the review fixes and the B3 harness). Core report: `../LumenCortex/docs/reports/context-continuity-2026-10-21.md`. Pinned through the temporary `url.insteadOf` mechanism of earlier pins (`GOPROXY=direct GOPRIVATE=github.com/edynasty/*`), removed afterwards. No `replace`, no `go.work`. `docs/lumencortex.schema.json` is byte-identical to Core's (`cmp`).
- **Status:** implemented and validated locally, including a native run (below); not pushed.

## Behaviour

- **Task pane › Notes:**
  - Core's notes are listed newest first. Each shows its author ("You"/"Agent") and its cited paths.
  - Any note can be removed: the user may remove an agent's note (ADR-0010 D1).
  - The add field counts UTF-8 bytes against Core's 512-byte bound and disables Add above it.
  - Every edit goes through `EditTaskNote` → Core's Task State inbox, and the pane shows the view Core returns.
- **"Remember" on a message:**
  - User and assistant messages with text carry a note action next to Copy. Runtime notices (`origin` rows), tool rows, and assistant rows that only call tools do not.
  - It opens an editor seeded with the message, cut to 512 bytes on a code point boundary (`clipNote`) and saying so. The user keeps what matters and saves it as a user note of the thread.
  - Core's refusal (for example 32 user notes) is shown in the editor, which stays open.
  - On success the action shows "Saved as a note" briefly.
- **Limits:**
  - `frontend/src/lib/core-limits.json` holds the note bounds (512 B, 32 notes). `TestFrontendCoreLimitsMatchCore` keeps it equal to the pinned Core.
  - `errTooManyNotes` is a Core error marker, kept equal by `TestFrontendCoreErrorMarkersMatchCoreSentinels`.

## Files

- **Backend:**
  - `internal/backend/taskstate.go`: `EditTaskNote`.
  - `app.go`: binding.
  - `internal/backend/taskstate_test.go`: tests.
  - `internal/backend/models_test.go`: limits and marker equality.
- **Frontend types and wire:** `types.ts` (`TaskNote`, `TaskNoteEdit`), `lib/bridge.ts`, `lib/core-errors.{json,ts}`, `lib/error-presentation.ts`, `lib/core-limits.json`, `lib/note-text.ts`.
- **Notes section:**
  - `components/inspector/NotesSection.tsx` (new; keeps `TaskStatePanel.tsx` under the 350-line architecture bound).
  - `TaskStatePanel.tsx`, `useTaskState.ts` (`editNote`), `inspector.css` (note rows reuse the reference-row and brief-editor styles).
- **Remember:**
  - `components/thread/RememberAction.tsx` (new), `MessageItem.tsx`, `ThreadWorkspace.tsx`, `thread.css`.
  - `app/ThreadTasksLayer.tsx` supplies `onRemember`.
  - `app/presentation-model.ts` carries the labels.
- **Other:** `lib/i18n/app-copy.ts` (zh-CN + en); `visual/fixture-data.ts` (notes in the visual fixture; user note ids shaped like Core's).

## Verification actually run

- **Go:** `go build ./...`, `go vet ./...` and `go test -count=1 ./...` pass.
- **Frontend:**
  - `npx tsc --noEmit` passes.
  - `npx vitest run`: 59 files, 290 tests pass, including the architecture line bound.
- **New tests:**
  - `TaskStatePanel.test.tsx` "lists notes newest first, removes one, refuses an over-long add and adds a trimmed note".
  - `MessageItem.test.tsx` "seeds the editor with the message cut to the note bound and saves the edited text".
  - `MessageItem.test.tsx` "keeps the editor open with Core's refusal, and is not offered on runtime notices".
- **Visual harness:** `visual.html` served by Vite under Bun, because Node's ESM loader failed on Vite here. Headless Chromium at 1440×900, zh-CN:
  - The Notes section renders both fixture notes, newest first, with the author and the cited path.
  - On an assistant message, Remember opened the editor seeded with the message. Edited and saved, the editor closed, the action read "已记为笔记", and the note was listed first when the pane was read again.
  - On a user message, the editor opens under the bubble, right-aligned, with a byte count, Cancel and Save note.

## Native run (2026-10-21)

The packaged app (`scripts/build-macos.sh`) was launched with `XDG_CONFIG_HOME` pointing at a private global configuration, on a scratch Go repository. The full setup is in `agent-catalog-desktop-2026-10-20.md` § Native A3 run. It was driven through the macOS Accessibility API. Screen Recording is denied to this process, so the evidence is the AX tree and the session database, not screenshots.

- **Notes in the Task pane:** a child thread listed its own agent-written note (`note_write`), with the count `1`.
- **Remember on a child's final answer:**
  - The editor opened seeded with the answer and clipped: `511/512 字节` plus the clipping notice.
  - Save closed the editor, and the action read `已记为笔记`.
  - With no manual reload, the Notes count went to `2`, so the event-driven refresh works in the real app.
- **Defect found and fixed:**
  - **Symptom:** an assistant row that only carries `tool_calls`, with no `content`, rendered its raw JSON payload as message text, with Copy and Remember buttons. Remember would have offered to save tool-call JSON as a note.
  - **Origin:** the raw-JSON text predates this change; Remember made it worse.
  - **Fix:** `MessageItem` renders nothing for such a row, because its calls already show in the work group that follows.
  - **Regression tests:** `MessageItem.test.tsx` "shows nothing for an assistant row that only calls tools…" fails before the fix and passes after; "keeps the text of an assistant row that also calls tools" guards the other case.
  - **Native check:** on the same thread, the Remember buttons went from 8 to 6, one per row with text. `spawn_subagent`→`wait_subagent` and `shell`→`note_write` now sit next to each other.
- **After the fix:**
  - `npx tsc --noEmit` passes.
  - `npx vitest run`: 292 tests pass. The first full run had one failure in `components/scm/useSourceControlPage.test.tsx` "lists Core's files for the main checkout"; it passed in four further full runs. It is a flaky test, unrelated to this change, and left as is.
  - `go build`, `go vet` and `go test -count=1 ./...` pass.

## Context page notes (ADR-0010 B2, Desktop)

Implemented by a subagent from a written contract, then reviewed here; one defect was fixed in review.

- **Backend:**
  - `Runtime.ThreadNotes` / `App.ThreadNotes` return Core's `ReadThread(...).Notes` (`lcx.ThreadNote`: id, by, text, cites with `stale`, note `stale`), never nil.
  - Freshness is Core's (ADR-0010 D4), checked against the main checkout. Desktop computes nothing.
- **Page:**
  - A `笔记 / Notes` sidebar filter lists every note of the loaded threads (the existing 30-thread bound), newest first. Each row shows the author, source thread, cite count and a `已过期` badge. Search matches note text and thread title, and a row opens its thread.
  - The thread detail gains a Notes section: author, text, cites (clicking one selects the file), a per-cite `文件已变更` marker, and Forget.
  - Forget is a user removal through `EditTaskNote`; the returned Task State replaces the page's copy.
  - Notes are not graph nodes. Files: `components/context/{ContextNotes.tsx, useContextNotes.ts}` (new), `ContextDetail.tsx`, `useContextPage.tsx`, `context-page-types.ts`, `context.css`, `types.ts`, `lib/bridge.ts`, `lib/i18n/app-copy.ts`, `visual/app-stub.ts`.
- **Freshness cache:**
  - Freshness is read lazily (the selected thread, plus every cited thread while the notes filter is on) and cached per Task State version.
  - **Review fix:** files change without a Task State edit, so a version-keyed cache would have shown old freshness for the life of the app. The cache is now dropped when the page is left.
  - A failed read shows no marker and does not block the list.
- **Tests:**
  - Go: `TestThreadNotesFreshness`. Fresh cite → not stale; changed file → note and cite stale; removed file → stale; empty thread → empty slice; unknown session → error.
  - Vitest (`components/context/useContextPage.test.tsx`):
    - notes from two threads newest first, search, open source thread;
    - stale badge and cite, none for a fresh thread;
    - Forget calls `editTaskNote({id, remove:true})` and the note disappears;
    - a freshness failure still lists notes;
    - "reads freshness again when the page is entered again…", which failed before the review fix and passes after.
- **Run:**
  - `go build`, `go vet` and `go test -count=1 ./...` pass.
  - `npx tsc --noEmit` passes.
  - `npx vitest run`: 60 files, 297 tests pass.
  - Visual harness (Vite under Bun, headless Chromium 1440×900, zh-CN): the notes filter reads `笔记 3`, and the agent note citing `provider_config.go` shows `已过期`. Its thread detail shows the Notes section with `文件已变更` on the cite. Forget dropped the count to `笔记 2`.
  - Not run natively: the native app's notes path was exercised earlier (Task pane, Remember), but the Context page was not.

## Unverified / limits

- Remember on a child thread adds a user note to that child's Task State. This follows Core's rules. It was exercised natively once (above), with no dedicated test.
- The scratch workspace path stays in the app's recent-projects list. That list is WebView `localStorage`, outside `XDG_CONFIG_HOME`, and the path no longer exists.

## Open

- The CLI `lcx-go context list|show|forget` from the proposal is not built. Hosts read notes through `ReadThread` and edit them through `EditTaskState`.
- Neither repo is pushed; Core `3e4f418` must be pushed before this pin downloads cleanly.
