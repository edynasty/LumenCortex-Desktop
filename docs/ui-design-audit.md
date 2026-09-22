# LumenCortex Desktop — UI / UX / Frontend Audit

Date: 2026-09-21

Scope:
- current React/Wails Desktop shell,
- New Task Composer,
- Provider settings,
- Thread/Inspector shell,
- design system,
- Figma reference screens,
- motion and accessibility.

Severity:
- **P0**: correctness, trust, or architecture risk; fix before expanding the surface.
- **P1**: meaningful product/design debt; fix during the next UI slices.
- **P2**: polish or completeness; fix after core workflows stabilize.

## 1. Executive summary

The current direction is materially better than the original dashboard-like UI, but implementation and design are not yet fully aligned.

The largest risks are not colors or icon styling. They are:

1. runtime state has more than one frontend truth source,
2. secret handling does not fully match the product security promise,
3. navigation/state architecture will become brittle as Review/Extensions arrive,
4. typography and control density are sometimes too small,
5. responsive behavior is specified but not visually designed at every breakpoint,
6. motion existed only as ad-hoc CSS before the motion specification was added,
7. the remaining monolithic App component will slow future UI work.

## 2. P0 findings

### P0-01 — Active run state has two truth sources

Current behavior:
- sidebar grouping considers both `session.status === "running"` and `activeRuns[id]`,
- selected-thread run controls mainly depend on the in-memory `activeRuns` map.

Risk:
- after UI reload, runtime restart, stale session recovery, or future Core supervisor work, the sidebar can show a thread as running while Stop is unavailable.

Required direction:
- Core/runtime owns active-run truth,
- Desktop subscribes to/query this state,
- persisted session status and active execution state must have explicit semantics.

Roadmap dependency:
- CORE-04 run supervisor.

### P0-02 — Raw API keys may be persisted in config

Current Provider form accepts arbitrary text in `settings.apiKey`.

If the user types a real key, it is written to:
- global `lumencortex.json`, or
- project `lumencortex.json`.

This conflicts with the design principle that secrets should be referenced rather than exposed/persisted.

Required direction for current phase:
- prefer and visibly validate `{env:VAR_NAME}`,
- explicitly warn before saving a literal secret,
- never display resolved secret values.

Preferred future direction:
- macOS Keychain integration,
- config stores a keychain/environment reference only.

### P0-03 — Provider save failure handling was unsafe

Previous behavior:
- `saveCatalog()` reported an error and re-threw,
- event handlers invoked async mutation methods using `void ...`,
- failed saves could become unhandled Promise rejections.

Status:
- **Fixed**.
- save operations now return success/failure and UI follow-up mutation only occurs after successful persistence.

### P0-04 — Motion had no system-level contract

Previous behavior:
- sidebar used one arbitrary duration,
- composer used another,
- thinking dots were independent,
- most panels appeared instantly,
- reduced-motion was not supported.

Status:
- **Motion specification added**: `docs/motion-design.md`.
- shared CSS motion tokens added,
- reduced-motion baseline added,
- current high-value surfaces use restrained transitions.

Remaining:
- future components must use the shared motion tokens.

## 3. P1 product / UX findings

### P1-01 — New Task initial-session behavior is not explicitly designed

On initial app load, the UI selects the first returned session when sessions exist.

On project switch, it intentionally enters New Task.

This is inconsistent.

A deliberate restore policy is required:
- restore last selected thread/view per project, or
- always enter New Task,
- never rely on “first session in returned list” as an accidental policy.

Recommended:
- persist the last view/thread per project,
- fall back to New Task if unavailable.

### P1-02 — Provider settings has duplicated page title

The topbar already identifies the workspace as “Models & Providers”.
The Provider page also renders an H2 with the same title.

Effect:
- unnecessary vertical hierarchy,
- feels like a web settings page inside another page.

Recommended:
- topbar = navigation/context,
- content header = descriptive settings header,
- or remove one of the duplicate titles.

### P1-03 — Composer uses native selects where richer desktop pickers are required

Current:
- native `select` for model,
- native `select` for permission.

This is acceptable for a first implementation but does not satisfy the final design goal.

Model picker needs:
- Provider grouping,
- model search,
- default indicator,
- context/output metadata,
- missing-secret state.

Permission picker needs:
- concise explanation of read-only/workspace/full,
- clear risk semantics.

Recommended:
- shared Popover + Command/Listbox primitives.

### P1-04 — New Task composition was vertically inconsistent with Figma

Previous code placed the task composer much higher than the Figma reference.

Status:
- **Adjusted** to a center-weighted layout.

Still requires screenshot QA at:
- 1440,
- 1180,
- 820,
- 560.

### P1-05 — Typography is too small in multiple settings surfaces

Examples:
- many Provider metadata labels are 8–9 px,
- runtime metadata is frequently 8–9.5 px.

Risk:
- visually resembles a monitoring/debug panel,
- less comfortable than Codex/Vetta-style desktop UI,
- weaker Chinese readability.

Recommended scale:
- normal UI text: 11–13 px,
- metadata: 9.5–11 px,
- 8 px only for exceptional technical annotation.

### P1-06 — Dark mode is documented but not implemented

The design system describes a future dark theme, but runtime CSS currently has only the light token set.

This is a design/code mismatch.

Required:
- explicit Light/Dark theme architecture,
- OS preference + user override,
- equivalent semantic tokens.

Do not implement dark mode as scattered selector overrides.

### P1-07 — Native browser confirmation dialogs break desktop visual consistency

Provider delete uses `window.confirm`.

Problems:
- platform/browser-style dialog,
- not aligned with LumenCortex visual system,
- cannot show richer consequences.

Required:
- shared Dialog component,
- destructive action copy,
- keyboard/focus handling.

### P1-08 — Provider editor loses local draft state when navigating away

Provider page is conditionally mounted from `workspaceView`.

Navigating back to the task workspace unmounts the Provider component.
Unsaved edits disappear.

Required:
- either prompt for unsaved changes,
- or persist draft state above the route boundary.

### P1-09 — Main workspace navigation model will not scale

Current:
`WorkspaceView = "workspace" | "providers"`.

Future product needs:
- new-task,
- thread,
- provider-settings,
- review,
- extensions,
- possibly project actions/search.

Required before UI-05:
- route-like discriminated workspace state,
- explicit selected entity IDs,
- back/restore semantics.

A full web router is optional; clear state modeling is not.

## 4. P1 frontend architecture findings

### P1-10 — App.tsx remains a large feature container

Already extracted:
- Composer,
- Provider.

Still inside App:
- sidebar,
- thread rendering,
- inspector,
- terminal,
- runtime state,
- all translation copy,
- navigation.

Impact:
- high merge/conflict surface,
- difficult testing,
- encourages cross-feature state coupling.

Next extraction order:
1. Sidebar,
2. ThreadWorkspace,
3. Inspector,
4. app navigation shell,
5. i18n copy.

### P1-11 — Design tokens and implementation tokens drift

Design spec examples:
- bg/app `#F6F6F4`.

Runtime currently uses nearby but different values such as:
- `#F7F7F5`.

Small drift compounds across:
- surfaces,
- borders,
- typography,
- spacing.

Required:
- one code token file,
- Figma values generated/reconciled from the same semantic naming system,
- components never introduce arbitrary near-duplicate neutrals without a documented reason.

### P1-12 — No frontend component test setup

Current frontend scripts:
- dev,
- build,
- preview.

No unit/component tests.

Required:
- Vitest,
- Testing Library,
- Provider/Composer state tests,
- accessibility smoke tests.

Avoid adding a heavy end-to-end stack until the component architecture stabilizes.

### P1-13 — Thread renderer is still raw

Current assistant/tool content uses `pre`.

Missing:
- Markdown,
- code fences,
- compact tool cards,
- approval UI,
- message actions.

This makes the shell look more like a runtime console than a coding assistant.

Tracked by UI-04.

## 5. P1 accessibility findings

### P1-14 — Expand/collapse semantics were incomplete

Provider rows and advanced JSON did not expose expanded state.

Status:
- **Partially fixed** using `aria-expanded`.

### P1-15 — Default-model icon action lacked accessible name

Status:
- **Fixed**.

### P1-16 — Drawer keyboard/focus behavior

Status: **Fixed**.

Implemented:
- Escape closes active Sidebar/Drawer overlays,
- modal drawer focus remains trapped inside the active surface,
- opening moves focus into the overlay,
- closing restores focus to the original trigger,
- StrictMode-safe focus restoration prevents stale cleanup work from stealing focus.

### P1-17 — Composer textarea should have an explicit accessible name

Placeholder text is not a sufficient labeling strategy.

Required:
- explicit `aria-label` or visible label relationship.

## 6. Design deliverable gaps

### P1-18 — Figma currently has only canonical wide screens

Current reference:
- 1440 × 900 screens.

Responsive rules exist in documentation, but there are no equivalent Figma frames for:
- 1180,
- 820,
- 560.

Required:
- at least New Task,
- Running Thread,
- Provider Settings at narrow desktop widths.

### P1-19 — Component library is not yet a full variant/state library

Figma currently establishes core primitives, but final component specifications need:
- default,
- hover,
- focus,
- active,
- disabled,
- loading,
- error,
- selected,
- dark theme where applicable.

### P1-20 — Motion is documented but not yet prototyped in Figma

The motion specification is now source-controlled.

Figma still needs:
- interaction notes/prototype for drawer,
- Composer → Thread transition,
- Provider expand,
- Review inline comment.

This is useful for design review, but code/document specification remains the canonical timing/easing source.

## 7. P2 findings

### P2-01 — Sidebar needs thread search and richer recent-project behavior

Current grouping is a useful first step.

Still missing:
- search,
- pinned threads,
- recent projects,
- attention/unread behavior.

### P2-02 — Provider scope should remember the last selected scope

Re-entering Provider settings currently starts from the component's default scope.

Recommended:
- remember Global/Project scope per workspace/session.

### P2-03 — Error UI needs action-oriented recovery

Current toast is generic.

Future:
- provider error → open provider config,
- permission error → open permission picker,
- cancelled → resume,
- runtime unavailable → retry/reopen project.

### P2-04 — Empty/loading states need a shared component

Current surfaces define empty/loading states independently.

Required:
- shared EmptyState,
- shared inline loading pattern,
- no large decorative empty illustrations.

## 8. Motion status

Motion design source:
- `docs/motion-design.md`.

Implemented baseline:
- shared duration tokens,
- shared easing tokens,
- reduced-motion handling,
- sidebar transition,
- inspector entry,
- toast entry,
- Provider reveal,
- Composer focus transition,
- Agent thinking indicator.

Rules:
- no Framer Motion dependency for basic UI,
- opacity/transform preferred,
- no large spring/bounce effects,
- no fake progress animation.

## 9. Recommended execution order

1. Resolve secret-handling contract.
2. Resolve active-run source of truth.
3. Extract Sidebar and Thread workspace.
4. Build shared Popover/Dialog/Select primitives.
5. Replace native model picker.
6. Normalize typography/token drift.
7. Add frontend component tests.
8. Implement dark theme architecture.
9. Draw responsive Figma frames.
10. Complete Thread/Review surfaces.
