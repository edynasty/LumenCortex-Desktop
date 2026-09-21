# LumenCortex Desktop — Motion Design

## 1. Motion principles

Motion exists to explain state change, preserve spatial continuity, and provide feedback.

It must not become decoration.

Rules:

1. **Fast**
   - Desktop interactions should feel immediate.
   - Most feedback completes within 120–200 ms.

2. **Subtle**
   - Use 2–8 px translation at most.
   - Avoid scale-heavy, elastic, bouncing, or springy motion for normal UI.

3. **Spatial**
   - Drawers enter from the edge they belong to.
   - New content appears close to its final position.
   - A state change should not imply movement to a location that does not exist.

4. **Interruptible**
   - User input always wins.
   - Motion must not block pointer, keyboard, cancellation, or navigation.

5. **Performance-first**
   - Prefer opacity and transform.
   - Avoid animating width, height, top, left, large shadows, or expensive filters.
   - Do not animate streaming text.

6. **Accessible**
   - Honor `prefers-reduced-motion: reduce`.
   - Continuous decorative animation is prohibited.
   - Running state should not depend on animation alone.

## 2. Motion tokens

### Duration

| Token | Duration | Use |
|---|---:|---|
| motion/instant | 80 ms | press/toggle feedback |
| motion/fast | 120 ms | hover/focus/state color |
| motion/base | 160 ms | row selection, toast, content reveal |
| motion/panel | 200 ms | sidebar/inspector/drawer |
| motion/page | 220 ms | major workspace content transition |

No normal product transition should exceed 260 ms.

### Easing

```css
--ease-standard: cubic-bezier(.2, 0, 0, 1);
--ease-out: cubic-bezier(.16, 1, .3, 1);
--ease-in: cubic-bezier(.4, 0, 1, 1);
```

Use:
- `ease-out` for entering,
- `ease-in` for exiting,
- `ease-standard` for state changes.

## 3. Interaction motion matrix

| Interaction | Motion |
|---|---|
| Button hover | background/border/color · 120 ms |
| Button press | optional 1 px translateY · 80 ms |
| Thread selected | background/color · 120 ms |
| Sidebar mobile open | translateX · 200 ms |
| Sidebar backdrop | opacity · 160 ms |
| Inspector open | translateX 8 px + opacity · 180–200 ms |
| New Task → Thread | opacity + translateY 4 px · 160 ms |
| Workspace → Provider | opacity only · 160 ms |
| Provider expand | chevron rotate + body fade/translateY 2 px · 140–160 ms |
| Advanced JSON expand | fade/translateY 2 px · 160 ms |
| Dialog | opacity + translateY 4 px · 160 ms |
| Popover/select | opacity + translateY 2 px · 120 ms |
| Error toast | opacity + translateY 6 px · 160 ms |
| New message | opacity + translateY 3 px · 120 ms |
| Tool card complete | semantic color transition · 120 ms |
| Approval appears | fade/translateY 4 px · 160 ms |
| Diff line selection | background · 80 ms |

## 4. Agent activity motion

### Running

Allowed:
- three-dot thinking indicator,
- subtle determinate progress when real progress exists.

Not allowed:
- fake progress bars,
- large spinners in the main conversation,
- pulsing entire cards,
- infinite glowing borders.

The current thinking dots may continue, but:
- duration: about 1000–1200 ms,
- opacity/translate only,
- hidden when reduced motion is enabled.

### Tool execution

A new tool card may enter with:
- opacity 0 → 1,
- translateY 3 px → 0,
- 120–160 ms.

When tool status changes:
- only status icon/color changes,
- no card re-layout animation.

### Completion

Completion should be calm:
- status color transition,
- final answer reveal,
- no confetti or celebratory bounce.

## 5. Composer motion

### Focus
The composer may slightly strengthen border/shadow over 120–160 ms.

### Submit
On submit:
1. send button enters busy/running state immediately,
2. thread shell appears,
3. task content remains spatially stable,
4. composer relocates to thread footer without a large zoom.

Do not animate the whole composer from center to bottom with a dramatic path. A short crossfade/layout swap is enough.

### Stop
Arrow → Stop icon should change within 120 ms.
Do not spin the stop icon.

## 6. Sidebar and navigation

### Thread row
- hover: 120 ms,
- selected: 120 ms,
- status-dot color: 120 ms.

Do not animate list reordering when high-frequency runtime updates arrive.

### Attention states
Waiting approval may use a static amber marker.
Do not continuously pulse it.

## 7. Provider settings

Provider expansion:
- rotate chevron 90 degrees,
- content reveal by opacity/translate,
- no animated auto-height.

Add/edit forms:
- reveal in place,
- maintain provider row position,
- focus first meaningful field when opened.

Delete confirmation:
- use LumenCortex Dialog component,
- do not use native `window.confirm` in final UI.

## 8. Review / Diff

Diff content should remain visually stable.

Allowed:
- selected file row transition,
- inline comment popover,
- newly added review comment fade-in.

Do not:
- animate code lines on scroll,
- animate diff hunks entering one-by-one,
- animate additions/deletions continuously.

## 9. Reduced motion

Required CSS baseline:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}
```

Where motion carries spatial meaning, reduced-motion mode should use an immediate state change or opacity-only transition.

## 10. Engineering constraints

For LumenCortex Desktop:
- prefer CSS transitions/keyframes,
- use Web Animations API only when CSS is insufficient,
- do not add Framer Motion solely for basic transitions,
- do not introduce a runtime animation dependency until there is a proven need,
- motion tokens live with design tokens,
- component-specific motion should reference the shared tokens.

This keeps the Wails renderer lighter and consistent with the low-memory product goal.

## 11. Motion QA

Every animated interaction must pass:

- [ ] no layout thrash,
- [ ] no blocked click/keyboard input,
- [ ] no continuous decorative loop,
- [ ] reduced-motion behavior,
- [ ] 60 fps on normal desktop hardware,
- [ ] state remains understandable with animation disabled,
- [ ] transition does not exceed documented duration without a specific reason.
