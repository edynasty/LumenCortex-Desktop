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

### P0-01 — Active run state source of truth

Status: **Fixed**.

Runtime execution truth comes from Core `RunSupervisor`:
- Desktop `Runtime.State()` exposes `supervisor.Runs()` as `activeRuns`,
- selected-thread Run/Stop state is derived from `state.activeRuns`,
- Sidebar “Running” grouping uses the same active-run ID set,
- persisted `session.status === "running"` without an active supervisor run is treated as interrupted/attention state rather than a live run.

This removes the previous split between persisted session status and an independent frontend running map.

### P0-02 — Provider secret persistence

Status: **Fixed for Desktop-managed configuration**.

Implemented:
- graphical Provider forms accept environment variable names and persist only `{env:VAR_NAME}` references,
- backend save validation rejects literal API keys with `ErrLiteralProviderSecret`,
- Advanced JSON uses the same backend save path, so it cannot bypass the secret rule,
- resolved secret values are never written back to Provider configuration,
- backend regression tests cover literal-secret rejection and environment-reference persistence.

Future hardening:
- optional OS keychain-backed secret references can be added without changing this persistence contract.

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

### P1-01 — New Task initial-session behavior

Status: **Fixed**.

The app now has an explicit policy: startup and project switches enter `new-task`.
It no longer selects the first returned session as an accidental restore policy. Existing threads remain available from Sidebar groups.

### P1-02 — Provider settings duplicated the page title

Status: **Fixed**.

The topbar owns the route title. Provider content now starts with descriptive copy and the Add Provider action instead of repeating “Models & Providers” as a second page heading.

### P1-03 — Desktop model and permission pickers

Status: **Fixed**.

The shared Popover/Listbox-based `DesktopSelect` now provides:
- Provider grouping,
- model search,
- default-model badge,
- context/output metadata,
- missing Provider secret status without exposing secret values,
- keyboard navigation and focus restoration.

Permission pickers use the same desktop primitive and display concise Read only / Workspace / Full risk descriptions.

### P1-04 — New Task composition was vertically inconsistent with the intended reference

Status: **Fixed in implementation**.

The New Task surface uses the center-weighted Composer layout, and the production visual QA suite covers the required 1440 / 1180 / 820 / 560 widths.

The corresponding Figma reference frames are tracked separately under P1-18 because the current Figma file no longer contains the previously documented Product Screens page.

### P1-05 — Tiny UI copy was overused

Status: **Fixed for primary desktop surfaces**.

Provider, Inspector, Sidebar and Composer typography now follow the frontend standard:
- ordinary UI text remains compact but readable,
- metadata/helper text uses a 9.5–11 px floor,
- sub-9 px text is limited to exceptional compact annotations/badges.

Visual QA covers these surfaces at 1440 / 1180 / 820 / 560 widths.

### P1-06 — Dark theme architecture

Status: **Fixed**.

Implemented:
- semantic Light/Dark tokens in the shared token layer,
- `system | light | dark` user preference with local persistence,
- OS `prefers-color-scheme` support when preference is `system`,
- resolved theme applied on `html[data-theme]` before app render,
- Sidebar theme selector,
- core workspace / Provider / Inspector / Review / Extensions / Composer surfaces migrated to semantic tokens,
- dark visual QA at 1440 and 560 for six primary scenes.

Component CSS does not define scattered `[data-theme="dark"]` overrides; theme differences remain centralized in semantic tokens.

### P1-07 — Native browser confirmation dialogs

Status: **Fixed**.

Destructive Provider/Review/Worktree flows use the shared Dialog primitive with:
- product-controlled copy and styling,
- Escape handling,
- focus trap,
- focus restoration.

### P1-08 — Provider editor draft persistence

Status: **Fixed**.

Provider Settings is lazily mounted on first visit and then kept alive in memory when navigating to another workspace route.
Unsaved Provider, Model, and Advanced JSON draft state therefore survives route changes without being written to localStorage or disk.
Changing workspace still triggers the existing Provider controller reload/reset contract.

### P1-09 — Main workspace navigation model

Status: **Fixed**.

Navigation uses the discriminated `WorkspaceRoute` model:
- new-task,
- thread + session ID,
- providers,
- review + session ID,
- extensions + optional session ID.

Route/entity state and back semantics are explicit without adding a web-router dependency.

## 4. P1 frontend architecture findings

### P1-10 — App orchestration and feature extraction

Status: **Fixed for the current surface**.

Feature rendering and controllers have been split out of `App.tsx` into:
- Sidebar / workspace chrome,
- Thread workspace and message rendering,
- Inspector,
- Provider / Review / Extensions routes,
- runtime/session/workspace hooks,
- navigation and presentation helpers.

Architecture tests enforce the typed bridge boundary and a 350-line production TSX split threshold.

### P1-11 — Design tokens and implementation tokens drift

Status: **Fixed for the canonical semantic token set**.

Implemented:
- Light theme core semantic colors in `frontend/src/styles/tokens.css` now match `docs/design-system.md`,
- Sidebar/background/surface/hover/text/border/accent and semantic state colors use the documented canonical values,
- composer/dialog/sidebar/toggle/control shadows and warning-context chip surfaces are also semantic tokens with Light/Dark values,
- a Playwright regression test reads the design-system token table and compares it against the rendered CSS custom properties,
- the same suite scans every non-token stylesheet under `frontend/src` and rejects reusable hex/rgb/hsl literals,
- Dark theme remains code-defined while preserving the same semantic token names.

Component-specific derived surfaces may still use dedicated tokens, but reusable visual values must extend the canonical semantic system instead of introducing component-local color literals or near-duplicate neutrals.

### P1-12 — Frontend component test setup

Status: **Fixed**.

Frontend now uses:
- Vitest,
- Testing Library,
- user-event,
- jsdom,
- Playwright visual/interaction QA.

Provider, primitives, routing/presentation behavior, accessibility/focus behavior, theme behavior, typography, and responsive states have regression coverage.

2026-09-23 visual-artifact follow-up found that Split Review remained horizontally clipped at narrow widths even though the document itself stayed bounded. Review now automatically uses Unified mode at <=1024 px and hides the unavailable Split control. Visual regression coverage asserts the single-column renderer at 820 / 560; long source lines may still scroll horizontally inside the Unified diff by design.

### P1-13 — Thread renderer

Status: **Fixed for the current message contract**.

Thread rendering now includes:
- Markdown,
- syntax-aware code fences,
- compact tool/result cards,
- approval UI,
- copy/retry message actions,
- final-answer rendering.

Future message types should extend the same structured renderer instead of falling back to raw console-style `pre` blocks.

## 5. P1 accessibility findings

### P1-14 — Expand/collapse semantics

Status: **Fixed**.

Provider rows and Advanced JSON controls expose `aria-expanded`, with keyboard-focus behavior covered by the shared primitive and interaction test suite.

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

### P1-17 — Composer textarea accessible name

Status: **Fixed**.

New Task composer exposes an explicit `aria-label`; placeholder text is no longer the only accessible naming mechanism.

## 6. Design deliverable gaps

### P1-18 — Figma product screens and responsive frames

Status: **Open; Figma write work blocked in this session by the Starter-plan MCP call limit**.

Verified 2026-09-23:
- the linked Figma file currently exposes only the top-level page `01 Design System`,
- the previously documented `02 Product Screens` and `03 Flows & Specs` pages are not present,
- therefore the earlier documentation overstated the available 1440 reference screens.

Required when Figma write access is available:
- create/restore Product Screens,
- New Task at 1440 / 1180 / 820 / 560,
- Running Thread at 1440 / 1180 / 820 / 560,
- Provider Settings at 1440 / 1180 / 820 / 560,
- Review / Diff at the widths that materially change its layout.

Production Playwright responsive QA remains the implementation truth until these design frames exist.

### P1-19 — Component library state/variant coverage

Status: **Open; Figma write work blocked in this session by the Starter-plan MCP call limit**.

The current `01 Design System` contains a small reusable set including:
- Primary / Secondary / Destructive Button components,
- Default Input,
- three-way Segmented Control,
- Running Status,
- Default Thread Row,
- New Task Composer.

It does not yet represent the full production state matrix.

Required:
- default,
- hover,
- focus,
- active/pressed where applicable,
- disabled,
- loading,
- error/invalid,
- selected,
- semantic status variants.

Dark theme remains code-defined because the current Figma variable-mode constraint makes Light the canonical design mode.

### P1-20 — Figma interaction and motion prototypes

Status: **Open; Figma write work blocked in this session by the Starter-plan MCP call limit**.

The source-controlled motion contract in `docs/motion-design.md` remains canonical.

When Figma write access is available, add `03 Flows & Specs` with:
- Sidebar/Inspector drawer open-close behavior,
- Composer → Thread transition,
- Provider expand/collapse,
- Review inline-comment flow,
- reduced-motion notes and timing/easing references.


## 7. P2 findings

### P2-01 — Sidebar thread navigation and attention

Status: **Fixed for current durable thread state**.

Implemented:
- thread search across title, goal, Provider, and model,
- pinned / recent / archived grouping,
- recent project shortcuts,
- explicit “Needs attention” grouping,
- warning severity for approval gates,
- danger severity for failed, interrupted, and stale-running threads,
- accessible row names that include thread status,
- persistent desktop Sidebar collapse with `Meta+B / Control+B`.

Unread state is intentionally **not inferred** from timestamps. A future unread badge should be backed by a durable read cursor/event from Core rather than a frontend-only guess.

### P2-02 — Provider scope remembers the last selected layer

Status: **Fixed**.

The Provider controller remembers Global/Project scope per workspace in localStorage.
Only the scope enum is persisted; Provider drafts, Advanced JSON, and secret material remain in memory/config-specific paths.

### P2-03 — Action-oriented error recovery

Status: **Fixed for current recoverable error classes**.

The desktop error layer classifies recoverable errors and presents direct actions:
- Provider/model/secret errors → Provider settings,
- permission/policy errors → Run permissions,
- workspace/runtime unavailable → reopen or choose project,
- interrupted/error threads expose Retry in the thread surface.

Unknown errors remain dismissible without inventing an unsafe recovery action.

### P2-04 — Shared empty/loading states

Status: **Fixed for primary surfaces**.

Shared primitives now provide:
- `EmptyState` with regular and compact variants,
- `LoadingState` with status/live-region semantics and reduced-motion-compatible pulse,
- consistent use across Review, Extensions, Thread, and Inspector primary empty/loading surfaces.

Small context-specific states such as Sidebar search emptiness remain intentionally compact and local.

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

## 9. Current continuation order

All previously listed implementation fixes are complete.

1. Complete P1-18 through P1-20 when Figma write access is available.
2. Keep production visual QA and the design-token contract green.
3. Continue code work only for a reproducible defect, integration/runtime bug, visual-regression finding, or newly approved product milestone.

Do not reopen completed Provider / Composer / Sidebar / Thread / Review / Worktree / LSP / MCP / Extensions milestones solely to recreate historical sequencing.
