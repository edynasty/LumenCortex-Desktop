# Figma delivery finalizer

The canonical Figma delivery contract is `delivery-manifest.json`. The implementation lives in `finalize-lumencortex.mjs`.

Target file:

`Jr6qaL9kGPtj45VYn9m62q`

The builder has three targets:

- `design-system` — completes the production component state matrix on `01 Design System`.
- `product-screens` — creates/rebuilds `02 Product Screens` with New Task, Running Thread, Provider Settings, and Review Diff at 1440 / 1180 / 820 / 560.
- `flows-and-specs` — creates/rebuilds `03 Flows & Specs` with the four required interaction flows and reduced-motion/timing annotations.

## Applying through Figma MCP

Load the mandatory Figma skills before each write. For each target, execute a separate `use_figma` call because the Plugin API workflow allows at most one page switch per invocation.

Read `finalize-lumencortex.mjs`, remove the leading `export ` keyword from the function declaration when embedding it as a `use_figma` code body, then append:

```js
return await buildFigmaDelivery(figma, "design-system");
```

Repeat with:

```js
return await buildFigmaDelivery(figma, "product-screens");
```

and:

```js
return await buildFigmaDelivery(figma, "flows-and-specs");
```

The generated assets are idempotent: previously generated LCX delivery nodes are removed before rebuilding.

## Validation

Repository CI performs:

- JavaScript syntax validation for `finalize-lumencortex.mjs`,
- manifest coverage tests for every required screen width,
- component-state coverage tests,
- interaction-flow/motion-contract coverage tests.

After applying to Figma, visually verify the generated pages against the latest Playwright artifacts and keep Light mode as the canonical Figma design mode. Dark mode remains code-defined.
