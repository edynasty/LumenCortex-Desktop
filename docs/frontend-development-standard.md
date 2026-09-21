# Frontend Development Standard

This document defines the UI/UX and frontend engineering rules for LumenCortex Desktop.

The goal is not to imitate a specific product pixel-for-pixel. The goal is to maintain a coherent, native-feeling coding-agent workspace with stable interaction patterns.

## 1. Product UI principles

The frontend MUST optimize for:

1. **Agent-first workflow**
   - The primary action is describing and running a coding task.
   - Sessions/threads are first-class.
   - Tool activity and code changes are secondary but always inspectable.
   - Runtime telemetry is supporting information, not the visual center.

2. **Quiet visual hierarchy**
   - Prefer whitespace, typography, alignment and subtle borders over decoration.
   - Avoid gradients, glowing effects, decorative cards, oversized badges, and dashboard-style metric walls.
   - Every persistent panel must justify its space.

3. **Native desktop density**
   - Controls should feel like a desktop development tool, not a marketing page.
   - Prefer compact 28–36 px controls.
   - Avoid mobile-first oversized UI on desktop.

4. **Local-first clarity**
   - Always make the active workspace visible.
   - Make provider/model selection visible near task submission.
   - Make permissions and running state discoverable.

5. **Chinese-first**
   - Default locale is Simplified Chinese.
   - English is supported.
   - Technical identifiers such as model IDs, provider IDs, file paths and commands remain unchanged.

---

## 2. Information architecture

The canonical desktop layout is:

```text
┌──────────────┬───────────────────────────────┬────────────────────┐
│ Project/     │ Thread / task workspace       │ Optional inspector │
│ sessions     │                               │                    │
│              │ messages / diffs / tools      │ activity           │
│              │                               │ provider/run       │
│              │ composer at bottom            │ terminal           │
└──────────────┴───────────────────────────────┴────────────────────┘
```

### Left sidebar

MUST contain only high-frequency navigation:
- product identity,
- new task,
- workspace switcher,
- session/thread list,
- small footer actions.

MUST NOT become a general settings dashboard.

### Center workspace

MUST prioritize:
- current task,
- assistant/user/tool messages,
- running state,
- final result,
- future diff/file views,
- task composer.

The composer is the main interaction surface and MUST remain easy to reach.

### Right inspector

The inspector is optional and SHOULD contain contextual details such as:
- activity/tool events,
- provider/model configuration,
- run options,
- terminal,
- future diff metadata or approvals.

At narrower widths it MUST become an overlay/drawer rather than compressing the primary workspace excessively.

---

## 3. Responsive behavior

All significant UI changes MUST be checked at:

| Width | Expected behavior |
|---|---|
| 1440+ | Full sidebar + center + inspector |
| 1180 | Inspector becomes overlay/drawer |
| 820 | Sidebar becomes overlay/drawer |
| 560 | Compact toolbar, compact composer, no horizontal overflow |

Required invariants:
- No horizontal page scrolling.
- Composer remains usable.
- Session navigation remains reachable.
- Run/stop action remains reachable.
- Inspector can always be closed.
- Text truncation must not hide critical state without a discoverable full value.

Do not create additional breakpoints unless needed.

---

## 4. Design tokens

All reusable visual values MUST come from CSS custom properties or a future centralized token module.

Required token categories:
- background,
- sidebar,
- surface,
- hover/active surfaces,
- border/subtle border,
- primary/secondary/muted text,
- semantic colors: success/warning/error/info,
- monospace font,
- shadows.

Hard-coded values MAY appear only when:
- the value is component-specific,
- it does not represent a reusable semantic token,
- adding a token would reduce clarity.

### Spacing

Use a 4 px base grid.

Preferred spacing values:
- 4
- 8
- 12
- 16
- 20
- 24
- 32

Avoid arbitrary values unless visually necessary.

### Radius

Preferred radii:
- 6–8 px: small controls,
- 9–12 px: panels/rows,
- 14–18 px: primary composer/modal surfaces.

Avoid excessive pill-shaped UI. Pills are for statuses, filters, or compact segmented metadata only.

### Shadows

Shadows SHOULD be rare.

Use shadows mainly for:
- floating composer,
- drawers,
- dialogs,
- popovers.

Static panels SHOULD rely on background and borders.

---

## 5. Typography

Use system fonts:

```text
-apple-system
BlinkMacSystemFont
SF Pro Text
PingFang SC
Microsoft YaHei
Segoe UI
```

Code/IDs/commands use:

```text
ui-monospace
SFMono-Regular
Menlo
Monaco
Consolas
```

Rules:
- Body/UI text: 10–13 px depending on density.
- Task titles: 15–22 px.
- Do not use all-caps labels for normal Chinese UI.
- Avoid letter spacing for Chinese.
- Do not use bold everywhere. Most UI labels use 500–600 weight.

---

## 6. Icon rules

The only general UI icon library is:

```text
lucide-react
```

MUST:
- use Lucide for common actions and navigation,
- use consistent stroke width,
- keep icons 14–18 px in most controls,
- pair unfamiliar icons with labels.

MUST NOT:
- create hand-drawn SVG icons for common controls,
- use emoji as UI icons,
- use Unicode symbols such as `⌘`, `●`, `▶` as visual substitutes for icons,
- mix multiple icon libraries.

Custom SVG is allowed only for a true LumenCortex brand mark or a domain visualization not represented by Lucide.

---

## 7. Color and theme

The default visual direction is:
- neutral,
- low saturation,
- low contrast chrome,
- clear content hierarchy,
- native desktop feel.

Light theme:
- warm/neutral gray sidebar,
- white content surface,
- soft gray separators,
- dark neutral text.

Dark theme:
- neutral charcoal,
- no blue-black gaming/dashboard palette,
- avoid bright borders and glows.

Semantic colors MUST communicate state, not decoration:
- green: running/success,
- amber: waiting/approval,
- red: interrupted/error/destructive,
- blue: informational/navigation when needed.

---

## 8. Components and file structure

Target structure:

```text
frontend/src/
  components/
    app-shell/
    composer/
    inspector/
    provider/
    session/
    shared/
  lib/
    bridge.ts
    i18n.ts
  types.ts
  styles/
    tokens.css
    global.css
```

The project may migrate incrementally toward this structure.

Rules:
- A component SHOULD have one primary responsibility.
- New components SHOULD generally stay under ~250 lines.
- If a file exceeds ~350 lines, split by responsibility unless keeping it together is clearly simpler.
- Avoid giant `App.tsx` additions. Existing large-file debt is not precedent for new code.
- Do not create wrapper components that add no semantic value.

---

## 9. State ownership

Frontend state is divided into:

### Durable domain state

Owned by backend/Core:
- sessions,
- messages,
- agent steps,
- provider configuration,
- task status,
- usage,
- durable workflow state.

Frontend MUST retrieve it from Wails/Core.

### Transient UI state

Owned by React:
- selected tab,
- drawer open/closed,
- search query,
- unsaved editor text,
- currently selected model before submission.

### Bounded live state

Examples:
- live event feed,
- terminal tail,
- transient notifications.

These MUST have fixed limits.

Do not duplicate durable backend state into a permanent frontend cache.

---

## 10. Wails bridge rules

Every backend call MUST go through:

```text
frontend/src/lib/bridge.ts
```

Components MUST NOT directly access:

```text
window.go.main.App
```

Rules:
- bridge methods are typed;
- Wails DTOs have TypeScript types;
- error handling happens at workflow boundaries;
- do not expose Go implementation details in components;
- avoid many tiny backend round trips when one typed operation can return a coherent result.

---

## 11. Internationalization

User-visible strings MUST be centralized.

Do not:
- write new Chinese/English pairs inline across JSX,
- concatenate translated sentences from fragments,
- translate provider IDs/model IDs/file paths.

Preferred API shape:

```ts
const t = copy[locale]
t.newTask
t.providerSettings
```

Future migration to a dedicated i18n library is allowed when justified.

Chinese is the default locale.

---

## 12. Provider/model UX

The everyday workflow MUST expose a simple model picker near the composer or run controls.

Display:
- provider display name,
- model display name.

Persist/reference:
- `provider/model`.

Execution uses:
- configured real upstream `modelID`.

Provider management is a separate configuration surface.

Do not force the user to re-enter:
- base URL,
- endpoint,
- API key,
- model ID

for every task.

Secrets SHOULD be represented as:

```json
"apiKey": "{env:DEEPSEEK_API_KEY}"
```

The UI MUST NOT reveal resolved secret values.

---

## 13. Lists, logs, and memory

The app is intended for long-running tasks.

Therefore:
- live events MUST be bounded;
- message loading SHOULD be paged or capped;
- large tool output MUST be truncated/streamed;
- future file trees SHOULD use virtualization for large repositories;
- future diff views SHOULD lazy-load large files;
- never keep the entire lifetime event stream in React memory.

A long task must not imply linear frontend memory growth.

---

## 14. Accessibility and interaction

MUST:
- provide accessible labels for icon-only buttons,
- support keyboard focus,
- keep destructive actions visually distinct,
- maintain readable contrast,
- allow Escape/close interactions on drawers/dialogs where applicable.

SHOULD:
- support keyboard shortcuts for new task, focus composer, toggle sidebar, and run/stop,
- surface shortcut hints sparingly.

Do not make hover the only way to discover critical actions.

---

## 15. Loading, empty, error, running states

Every remote/backend workflow must consider:
- initial loading,
- empty state,
- active/running,
- success/completed,
- interrupted,
- waiting for approval,
- error.

Errors MUST be human-readable and SHOULD retain technical details when useful.

Do not silently swallow operational errors unless the action is explicitly best-effort.

---

## 16. Visual-change acceptance checklist

Before merging a meaningful UI change:

- [ ] Uses existing design tokens.
- [ ] Uses Lucide icons.
- [ ] No new decorative gradients/glows.
- [ ] Chinese copy exists.
- [ ] English copy exists where the surface is bilingual.
- [ ] 1440 px layout checked.
- [ ] 1180 px layout checked.
- [ ] 820 px layout checked.
- [ ] 560 px layout checked.
- [ ] No horizontal overflow.
- [ ] Keyboard focus remains usable.
- [ ] Composer remains usable.
- [ ] Inspector/sidebar remain closable.
- [ ] New arrays/logs are bounded.
- [ ] `npm run build` passes.

---

## 17. Forbidden patterns

Do not introduce:
- dashboard-first home screens,
- decorative metric cards as primary UI,
- neon/glow styling,
- random gradients,
- multiple icon libraries,
- inline SVG copies of common icons,
- giant unstructured JSX files,
- secrets in localStorage,
- backend API calls outside the bridge,
- infinite live event arrays,
- provider credentials repeated per session,
- UI state pretending to be durable runtime state.

When a new requirement conflicts with this standard, update the standard deliberately instead of silently bypassing it.
