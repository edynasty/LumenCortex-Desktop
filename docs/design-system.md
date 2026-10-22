# LumenCortex Desktop — Design System

Figma source:
`https://www.figma.com/design/Jr6qaL9kGPtj45VYn9m62q`

## 1. Visual direction

LumenCortex is a desktop coding tool.

The visual language should be:
- compact,
- neutral,
- calm,
- low-decoration,
- high-information clarity,
- native-feeling.

Avoid:
- neon/glow,
- dashboard cards,
- generic AI sparkle motifs,
- oversized marketing spacing,
- excessive pills,
- decorative gradients.

## 2. Desktop grid

Canonical wide screen (values from `frontend/src/styles/tokens.css`, layout section):
- 1440 × 900 reference.
- Toolbar: `--toolbar-h` 48 px; rail: `--rail-w` 52 px.
- Sidebar: `--sidebar-w` 264 px default, user-resizable.
- Primary workspace: flexible; reading column `--reading-w` 760 px.
- Inspector: `--inspector-w` 320 px default, user-resizable.
- Pane gap: `--pane-gap` 8 px.

## 3. Breakpoints

| Width | Behavior |
|---|---|
| >= 1240 | sidebar and inspector docked |
| 880–1239 | sidebar docked, inspector drawer |
| 640–879 | sidebar drawer + inspector drawer, rail stays |
| < 640 | compact: the rail moves into the sidebar drawer |

The thresholds are `INSPECTOR_DOCK_MIN`, `SIDEBAR_DOCK_MIN` and `COMPACT_MAX` in
`frontend/src/components/app-shell/AppShell.tsx`; the code is the contract.

## 4. Spacing scale

4 px base grid (`--sp-1` … `--sp-8`):

| Token | Value |
|---|---:|
| `--sp-1` | 4 |
| `--sp-2` | 8 |
| `--sp-3` | 12 |
| `--sp-4` | 16 |
| `--sp-5` | 20 |
| `--sp-6` | 24 |
| `--sp-8` | 32 |

## 5. Radius

| Token | Value | Use |
|---|---:|---|
| `--r-xs` | 4 | tags, tiny inline buttons |
| `--r-sm` | 6 | compact controls, rows inside a control |
| `--r-md` | 8 | buttons, inputs, list rows |
| `--r-lg` | 10 | cards |
| `--r-xl` | 14 | composer, popovers, menus, message bubble, toast |
| `--r-pane` | 12 | window panes and drawers |
| `--r-sheet` | 16 | modal sheet, dialogs |
| `--r-pill` | 999 | status pills, badges, round send button, meters |

Avoid pills unless representing status or compact metadata.

### Semantic shape tokens

Production CSS picks shape by role where one of these applies; the raw scale above covers the rest.

| Token | Value | Use |
|---|---:|---|
| `--r-card` | 10 | any card: thread blocks, check cards, progress, graph, choices |
| `--r-inset` | 6 | a row, segment or small button inside a card or control |
| `--ctl-field` | 30 | every side-by-side field: `.input`, text field, select trigger |
| `--ctl-icon` | 26 | icon-only button inside content (`.icon-btn.is-sm`, row actions) |
| `--ctl-icon-lg` | 30 | icon-only button in the toolbar and rail (`.icon-btn`) |

One edge convention: a 1 px edge on a box is an inset ring (`box-shadow: inset 0 0 0 1px`), never
`border`, so it renders the same at 1x and 2x. `border-top/bottom` hairlines between sections stay.

## 6. Control heights

| Token | Value | Use |
|---|---:|---|
| `--ctl-xs` | 22 | the worktree pill in the toolbar |
| `--ctl-sm` | 26 | small buttons (`.btn-sm`), toast actions, in-content icon buttons (via `--ctl-icon`) |
| `--ctl-md` | 30 | buttons, fields (via `--ctl-field`), toolbar/rail icon buttons (via `--ctl-icon-lg`) |

There is no taller control: a field and the button beside it are both 30 px.

## 7. Color tokens

Light and dark values are defined only in `frontend/src/styles/tokens.css` (`:root[data-theme="light"]`
and `:root, :root[data-theme="dark"]`); this document does not copy them. Both themes are Lumen Glass:
a deep navy (dark) or pale blue-grey (light) window ground with a soft light source, translucent
content and float surfaces over it, and one blue accent.

Text uses three steps: `--fg`, `--fg-2`, and `--fg-3`, the lightest readable text (at least 4.5:1 on
every surface text sits on, including the sidebar's bare ground). `--fg-4` is for non-text only (icons,
separators, dots; at least 3:1). Semantic colours are `--ok`, `--warn`, `--bad` with `-soft` tints.
The Playwright test "text and non-text contrast hold" computes these ratios from the live tokens in
both themes.

## 8. Dark theme

Dark is a first-class theme with the same semantic hierarchy and contrast rules as light, no glow.
The theme follows the system unless the user picks one; the native window background follows it too.

## 9. Typography

Families (`--font-ui`, `--font-display`, `--font-mono`): the system UI font (SF Pro) with PingFang SC
for Chinese; code uses `ui-monospace` / SF Mono.

### Type scale

| Token | px | Use |
|---|---:|---|
| `--text-display` | 24 | new-thread heading |
| `--text-xl` | 20 | thread title |
| `--text-lg` | 16 | article headings |
| `--text-md` | 14 | toolbar title, composer |
| `--text-sm` | 13 | body, rows |
| `--text-xs` | 12 | secondary UI, hints |
| `--text-2xs` | 11 | metadata |
| `--text-3xs` | 10 | badges only |
| `--mono-size` | 12 | code and diff |

Titles are usually Chinese: no negative letter-spacing.

## 10. Icons

General UI icon library:
- Lucide React only.

Typical icon size: 12–16 px inside rows and controls; up to 22 px for brand and empty states.

Do not:
- use emoji as controls,
- use multiple icon libraries,
- use generic sparkle icons for every AI action.

## 11. Shadows

Use only for:
- composer,
- dialogs,
- popovers,
- drawers.

Static panels use borders/surface contrast.

Production CSS uses semantic elevation tokens rather than component-local color literals:
- `--shadow-control`: compact active controls (selected segment, switch),
- `--shadow-pane`: window panes,
- `--shadow-card`: cards inside a pane,
- `--shadow-float`: popovers, menus, the error toast,
- `--shadow-composer`: the composer,
- `--shadow-sheet`: dialogs, the settings sheet, drawers.

Overlay scrims use `--surface-scrim`; warning context uses `--warn-soft`. Light/dark values are defined only in `frontend/src/styles/tokens.css`. Non-token component stylesheets must not embed reusable hex/rgb/hsl literals.

### Material

Float glass (`--surface-float` plus a 28 px backdrop blur) is for the composer, popovers and the modal
sheet. Drawers and the error toast use `--surface-float-solid` with no blur: a drawer sits over a scrim
and a toast lives seconds, so blur there costs a full-pane layer for no readable gain. At most two
layers blur at once. Native chrome (toolbar, rail, thread rows, section labels, chips, buttons) is
`user-select: none`; message text, code, diffs and paths stay selectable, and so does the content of a
popover (a branch or path shown there is something to copy). The window itself never rubber-bands
(`html, body { overscroll-behavior: none }`); pane scrollers contain their overscroll, and scrollers
nested in content (code blocks, tool output) keep the default so the wheel over them still scrolls
the thread. Under `prefers-contrast: more` the content and float surfaces turn solid, hairlines
use the strong line and `--fg-4` takes `--fg-3`.

## 12. Core components

### Button
Variants:
- Primary
- Secondary
- Destructive
- Ghost/Icon

States:
- default
- hover
- focused
- disabled
- loading

### Input
States:
- default
- focused
- invalid
- disabled

### SegmentedControl
Use for:
- Chat / Work / Review
- Global / Project scope where appropriate.

### ThreadRow
Shows:
- title,
- status,
- updated time,
- attention state.

### Composer
Contains:
- task text,
- project,
- model,
- permission,
- environment,
- send/stop state.

### ProviderCard
Contains:
- provider identity,
- URL/protocol,
- model count,
- CRUD actions,
- expandable ModelRows.

### ModelRow
Contains:
- display name,
- upstream modelID,
- limits,
- default state,
- actions.

### StatusIndicator
Semantic only:
- running/success,
- waiting,
- interrupted/error,
- info/completed.

## 13. Density rules

- Sidebar rows: 44–52 px.
- Compact toolbar controls: 28–32 px.
- Avoid card padding >24 px for normal desktop UI.
- Long metadata truncates with discoverable full value.
- Default chrome should not compete with task content.

## 14. Accessibility

- Icon-only buttons need aria-label.
- Visible focus ring.
- Destructive actions distinct.
- Semantic color not sole signal.
- Keyboard navigation preserved.
- Minimum readable contrast: see the rule below.

### Contrast rule

- `--fg-3` is the lightest colour any readable text (labels, timestamps, placeholders, hints, diff
  markers, code comments) may use. It passes 4.5:1 on content, card hover, control, selected row and
  float, in both themes.
- `--fg-4` is for non-text only: icons, chevrons, separators, status dots, strike lines, disabled
  controls. It passes 3:1 on content, card hover and float. Never set text in it.
- Semantic text (`--ok`, `--warn`, `--bad`, `--accent-fg`) passes 4.5:1 on its own `-soft` tint; the
  label on the primary gradient (`--fg-on-accent`) passes 4.5:1 at both gradient stops.
- `visual-tests/app.spec.ts` ("text and non-text contrast hold in the … theme") computes these ratios
  from the live tokens in both themes. Change a colour token and that test tells you whether it holds.

## 15. Motion

Motion is specified separately in [Motion Design](motion-design.md).

Core rules:
- 80–220 ms for normal desktop interactions,
- opacity/transform preferred,
- no decorative spring/bounce motion,
- no fake progress animation,
- respect `prefers-reduced-motion`,
- use shared motion tokens from the frontend design-token layer.
