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

Canonical wide screen:
- 1440 × 900 reference.
- Sidebar: 248 px.
- Primary workspace: flexible.
- Inspector: 360 px.
- Provider settings inspector: up to ~600 px.

## 3. Breakpoints

| Width | Behavior |
|---|---|
| >=1440 | full desktop |
| 1180–1439 | inspector drawer |
| 820–1179 | sidebar persistent where space permits; inspector drawer |
| 560–819 | sidebar drawer + inspector drawer |
| <560 | guarded by Desktop minimum width |

## 4. Spacing scale

4 px base grid:

| Token | Value |
|---|---:|
| space/1 | 4 |
| space/2 | 8 |
| space/3 | 12 |
| space/4 | 16 |
| space/5 | 20 |
| space/6 | 24 |
| space/8 | 32 |

## 5. Radius

| Token | Value | Use |
|---|---:|---|
| radius/sm | 6 | compact controls |
| radius/md | 8 | buttons/input/rows |
| radius/lg | 12 | panels/cards |
| radius/xl | 16 | composer/dialog |

Avoid pills unless representing status or compact metadata.

## 6. Control heights

| Token | Value |
|---|---:|
| control/sm | 28 |
| control/md | 32 |
| control/lg | 36 |

## 7. Light color tokens

- bg/app: #F6F6F4
- bg/sidebar: #F3F3F0
- bg/surface: #FFFFFF
- bg/subtle: #F8F8F6
- bg/hover: #ECECEA
- text/primary: #252525
- text/secondary: #60605C
- text/muted: #8C8C86
- border/subtle: #E7E7E2
- border/strong: #D6D6D0
- accent/primary: #181918
- success: #2F7D4F
- warning: #9A691B
- danger: #B0444E
- info: #4F72A8

## 8. Dark theme

Dark theme remains defined in code tokens.

The current Figma Starter plan supports only one variable mode per collection in this workspace, so Figma uses Light as the canonical design mode. Dark must still preserve:
- neutral charcoal, not blue-black,
- no glow,
- equivalent semantic hierarchy,
- accessible contrast.

## 9. Typography

Product:
- -apple-system
- BlinkMacSystemFont
- SF Pro Text
- PingFang SC
- Microsoft YaHei
- Segoe UI

Figma:
- Inter used as portable approximation.

Code:
- ui-monospace
- SFMono-Regular
- Menlo
- Monaco
- Consolas

### Type scale
- Page/task title: 18–30
- Section title: 14–18
- Body/UI: 10–13
- Metadata: 8–10
- Code/diff: 9–12 monospace

## 10. Icons

General UI icon library:
- Lucide React only.

Typical icon size:
- 14–18 px.

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
- Minimum readable contrast.


## 15. Motion

Motion is specified separately in [Motion Design](motion-design.md).

Core rules:
- 80–220 ms for normal desktop interactions,
- opacity/transform preferred,
- no decorative spring/bounce motion,
- no fake progress animation,
- respect `prefers-reduced-motion`,
- use shared motion tokens from the frontend design-token layer.
