# UX & Provider Completion — Conversation Composer Redesign (Stage A items 4–8)

Date: 2026-10-19
Scope: Desktop repo. Items 4–8 of Stage A: execution environment moved to new-session configuration, shared composer redesign (Codex/Copilot pattern over Lumen Glass), Ask/Agent mode with real execution semantics, model + reasoning-effort pickers on the right, searchable model picker. Native-app verification of the composer is deferred until DesktopPlatform's build completes; this report covers the frontend, unit and Playwright verification.

## What changed

### 4. Execution environment out of the everyday composer
- `components/composer/NewTaskComposer.tsx`: Local/Worktree is a labeled execution-environment row (`.new-thread-exec`) under the new-task composer, with a "fixed once the session starts" note (`copy.runtimeFixedHint`). It is disabled until a project is open.
- `components/thread/ThreadComposer.tsx`: existing conversations render the session's runtime identity as a read-only chip titled `copy.runtimeFixed` (runtime identity is fixed at creation, ADR-0005). No switchable control exists in a thread.
- Session creation still goes through `CreateSessionWithRuntime(goal, paths, runtimeKind, base)`; Core's worktree ownership and no-switching guarantees are untouched.

### 5. Shared composer (both variants consistent)
- New `components/composer/Composer.tsx` renders both the new-task card and the thread follow-up: auto-growing textarea (cap `COMPOSER_MAX_HEIGHT` 220px, matches CSS), **Enter sends, Shift+Enter newline, IME-safe** (`nativeEvent.isComposing` or keyCode 229 never sends), attachment/context chips row above the input.
- Toolbar: **LEFT** = attach/context (+), Ask/Agent mode selector, authorization (permission) control, delegation control (kept separate, Core-labelled); **RIGHT** = model picker, effort picker, Send/Stop.
- Keyboard/a11y: model picker is a real combobox listbox (arrow/Home/End/Enter/Esc, aria-activedescendant, focus returns to the chip on close); menus support arrow navigation; visible focus rings come from the existing chip/menu styles; all collapsed icon chips keep accessible names.
- Global shortcuts: **⌘/ focuses the composer, ⌘⇧M opens the model picker** (checked against ⌘K/⌘,/⌘N/⌘1-3/⌘B/⌘I — no conflicts).
- Responsive 1440/1180/820/560: secondary chips are `is-collapsible` (icon-only under the 600px container query with accessible names/titles); the model chip keeps its label. Right-side pickers anchor their popovers `above-end` so they stay in the viewport at 560px (this was a real defect found by the hit-test suite after the redesign moved the model picker right).

### 6. Ask/Agent with real semantics
- `app/agent-config.ts` — one tested mapping, `resolveTurnOptions(mode, policy, delegation)`: **Ask ⇒ `read-only` + `none`** (never widens; Ask+full ⇒ read-only/none), **Agent ⇒ the user's policy and delegation unchanged**. `buildAgentConfig` sends `mode` plus the mapped turn.
- Backend guard (`internal/backend/runtime.go`): `AgentConfig.Mode` validated (`ErrInvalidMode`); `agentOptionsFor` forces `read-only`/no delegation for mode=ask before options are handed to Core. No new Core field.
- While in Ask, the permission and delegation controls keep their state and render **disabled with an explanation** (`copy.askCapsControls`); switching back to Agent restores them.
- Mode is app-level state like policy today — it survives thread switching (proven in Playwright).
- Follow-up attachments ride in the message text (`composeFollowUpInput`), because Core's continue input is plain text; the chips show the user exactly what is appended.

### 7. Model + reasoning-effort pickers on the right
- `app/model-selection.ts`: `effortsOfModel` (Core's effortOrder), `supportedEffort` — an unsupported effort is never sent (Core validates Effort). The picker shows only the displayed model's levels plus Default; models without efforts show a disabled "Effort fixed" chip (`copy.effortNotConfigurable`). Switching to a model that lacks the current effort resets to default (`useComposerModelControls`).

### 8. Searchable model picker
- `components/composer/ComposerPickers.tsx`: type-to-filter (name, provider/model ref, upstream model id, metadata), provider-grouped, **Recent group** (bounded 5, `lcx-recent-models` in localStorage — provider/model refs only, no keys), current model marked (selected row + checkmark), **pending marker** when a choice differs from the session pin, refused models (missing provider key, `toolCalling=false`) shown **disabled with their reason**, empty state, full keyboard navigation.
- Model identity across turns reuses the existing `useModelSelection`/`explicitModelRef` logic: the composer shows the session's pinned model (from Core session data) unless the user chose another; an explicit choice is sent once (`AgentOptions.ModelRef`, Core re-pins via rule `model.user`) and then reflected from Core; failover never rewrites the displayed identity (only `model.user`/`model.default` write `sessions.model_ref`).

## Verification (commands and observed results)

| Check | Command | Result |
|---|---|---|
| Types | `cd frontend && npx tsc --noEmit` | 0 errors |
| Unit tests | `cd frontend && npx vitest run` | **47 files / 204 tests passed** (new: Ask/Agent mapping, effort filtering, recent bound/order/dedupe/persistence, picker filtering/grouping/keyboard nav, disabled-row refusal, IME Enter, follow-up context composition, ThreadComposer behaviors) |
| Playwright | `cd frontend && npx playwright test` | **58 passed** (new: Ask caps + persists across thread switch; effort picker levels + not-configurable; model picker filter/reasons/Recent/re-pin on send; execution environment new vs read-only in thread; ⌘/ + ⌘⇧M shortcuts; layout loop covers the new toolbar at 1440/1180/820/560 with no clipped controls) |
| Frontend build | `cd frontend && npm run build` | ✓ built in 1.42s |
| Go backend | `go test -timeout 90s ./internal/backend` | ok (incl. new `agent_mode_test.go`: ask+full ⇒ read-only/none; agent keeps choices; invalid mode rejected, no state change) |
| Go vet | `go vet . ./internal/backend` | clean |

Defects found and fixed during verification:
1. Enter in the model search with no active row selected nothing — Enter now picks the first enabled match (standard combobox behavior).
2. Right-side picker popovers overflowed the right viewport edge at 560px after the redesign moved the model/effort pickers right — fixed by anchoring them `above-end`.

## Deferred
- Native app build/launch and accessibility-tree driving of the composer (per Main's instruction, after DesktopPlatform's build; `scripts/build-macos.sh` intentionally not run here).

## Files
Frontend: `types.ts`, `lib/i18n/app-copy.ts`, `app/agent-config.ts`(+test), `app/model-selection.ts`(+test), `app/hooks/useComposerModelControls.ts` (new), `app/hooks/useAgentActions.ts`(+test), `App.tsx`, `app/WorkspaceView.tsx`, `app/WorkspaceChrome.tsx`, `app/WorkspaceRouteContent.tsx`, `app/ThreadTasksLayer.tsx`, `app/presentation-model.ts`, `components/composer/Composer.tsx` (new), `components/composer/ComposerPickers.tsx`(+test), `components/composer/MenuPicker.tsx` (new split), `components/composer/NewTaskComposer.tsx`, `components/composer/composer.css`, `components/composer/new-task-composer.css`, `components/thread/ThreadComposer.tsx`(+test), `components/thread/ThreadWorkspace.tsx`, `components/thread/DelegationControl.tsx`, `visual/fixture-data.ts`, `visual/app-stub.ts`, `visual-tests/app.spec.ts`.
Backend: `internal/backend/runtime.go`, `internal/backend/agent_mode_test.go` (new).

## Native verification

Done on the built bundle; see "Composer (commit a158829) on the real bundle" in `ux-provider-completion-platform-2026-10-19.md` (execution-environment row, left/right toolbar split, ⌘⇧M picker, grouping, disabled rows with reason, filtering, effort chip following the selected model). No screenshots: Screen Recording is not granted to this process.

## Owner follow-up: Codex-style environment strip and composer spacing (2026-10-19)

### Environment strip (shared by both composer variants)
- New `components/composer/EnvironmentStrip.tsx` + `environment-strip.css`, rendered by `Composer` immediately above the textarea inside the same rounded card (same width, rounded top, hairline seam). It replaces both the new-task project chip and the thread's runtime chip.
- **New task**: the project name is a read-only label (folder icon, tooltip = full path) — the sidebar project switcher is the only selector. Next to it is the execution target (`Local` with the laptop icon, or `Worktree`). The gear on the right opens a `Configure environment` popover containing:
  - `New worktree` — a real `role="switch"` (Space/Enter, `aria-checked`), on = worktree runtime, off = local;
  - `Branch` — the base branch the existing `CreateSessionWithRuntime(goal, paths, runtimeKind, "HEAD")` flow takes, shown read-only as `HEAD` with the reason (`baseBranchFixed`);
  - notes that the worktree forks from the current HEAD and the environment is fixed once the session starts.
  - Escape/outside press closes it and returns focus to the gear. Without a project the strip keeps one clear `Open project` action (not a toolbar chip) and the gear is disabled.
- **Thread**: the same strip shows the project label and the session's fixed runtime identity (`Local`, or `Worktree` + branch), read-only; no gear and no environment control exists in a thread.
- The old `.new-thread-exec` row under the card and the toolbar `leftSlot`/`runtimeSlot` are removed.

### Toolbar
- Order: left = attach `+`, permission chip, Ask/Agent mode, delegation; right = model, effort, Send/Stop. The permission chip uses the warning token (`--warn`) when the policy is `full` (`.composer-policy.is-full`).
- Delegation stays next to permission; the 560 px geometry test confirms it does not crowd.

### Root cause and fix of the cramped thread composer
- The bar let every chip shrink (`flex: 0 1 auto; min-width: 0`), the hint had `flex-shrink: 10000`, and `.chip-label` ellipsized freely, so at the 712 px reading width the mode/policy/delegation labels collapsed to one or two characters. The runtime chip sat in the toolbar without `white-space: nowrap`, so `本地` wrapped vertically.
- Fix: chips are `flex: none`; only the model chip shrinks (min 112 px, max 220 px, ellipsis) because it is the primary choice; labels are `nowrap`; the keyboard hint is hidden when it cannot fit whole; the icon-only collapse threshold is now a container query at 620 px of the composer's real width (all labels need ~600 px); gaps and paddings use `--sp-*` tokens.
- The model chip shows the model's display name (`modelName`, else `modelID`, else the ref's last segment — never `provider/modelId`) and keeps the full ref in its tooltip.

### Verification

| Check | Command | Result |
|---|---|---|
| Types | `cd frontend && npx tsc --noEmit` | 0 errors |
| Unit tests | `cd frontend && npx vitest run` | **49 files / 217 tests passed** (new: environment strip switch/read-only/open-project, model display-name fallback) |
| Playwright | `cd frontend && npx playwright test` | **71 passed** (new: composer toolbar geometry at 1568/1440/1180/820/560 — one row, no wrapped/hard-clipped labels, 4 px gaps, no overflow; environment strip switch, fixed `HEAD`, focus return, read-only thread strip; full-access warning state) |
| Frontend build | `cd frontend && npm run build` | ✓ built (1738 modules; existing 500 kB chunk warning only) |

### Screenshots (visual harness, real Chromium)
Saved under `docs/reports/ux-provider-completion/`:
- `composer-new-light-1568.png`, `composer-new-dark-1568.png`, `composer-thread-light-1568.png`, `composer-thread-dark-1568.png`
- `composer-thread-light-1440.png`, `composer-thread-light-1180.png`, `composer-thread-light-820.png`
- `composer-thread-light-560.png`, `composer-thread-dark-560.png`, `composer-new-light-560.png`, `composer-new-dark-560.png`
- `composer-environment-light-1568.png`, `composer-environment-dark-1568.png`, `composer-environment-light-560.png`

All were inspected: labels stay whole at 1568/1440/1180/820, the 560 px bar collapses secondary chips to icons while keeping the model label, and the strip/popover read correctly in both themes. The popover at 560 px stays inside the viewport.

### Files
`components/composer/EnvironmentStrip.tsx` (new), `EnvironmentStrip.test.tsx` (new), `environment-strip.css` (new), `Composer.tsx`, `ComposerPickers.tsx`, `NewTaskComposer.tsx`, `composer.css`, `new-task-composer.css`, `components/thread/ThreadComposer.tsx` (+test), `ThreadWorkspace.tsx`, `app/WorkspaceRouteContent.tsx`, `app/WorkspaceView.tsx`, `app/model-selection.ts` (+test), `lib/i18n/app-copy.ts`, `visual-tests/app.spec.ts`, this report and the screenshots above.
