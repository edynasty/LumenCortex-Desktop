import { bridge } from "./bridge";

/**
 * macOS title-bar double-click action for the hidden-inset title bar.
 *
 * Wails v2.16 never zooms on a double click: the JS drag runtime drops the second click
 * of a double click by design (internal/frontend/runtime/desktop/main.js, `e.detail !== 1`)
 * and only forwards single-click drags, while the native side of TitleBarHiddenInset has
 * no title-bar view left to zoom with. This listener reports double clicks that land on
 * the same regions Wails treats as draggable (`--wails-draggable: drag`), and the Go side
 * (App.TitleBarDoubleClick) applies the user's AppleActionOnDoubleClick preference.
 *
 * Checks only the event target's computed style, exactly like Wails' own drag test: the
 * custom property inherits, so targets inside the toolbar resolve identically, and
 * interactive controls keep their `no-drag` override and their normal double-click.
 */
export function installTitleBarDoubleClick(): () => void {
  const onDoubleClick = (event: MouseEvent) => {
    const target = event.target;
    if (event.button !== 0 || !(target instanceof Element)) return;
    const draggable = window.getComputedStyle(target).getPropertyValue("--wails-draggable").trim();
    if (draggable !== "drag") return;
    event.preventDefault(); // the toolbar is chrome, not selectable text
    void bridge.titleBarDoubleClick();
  };

  document.addEventListener("dblclick", onDoubleClick);
  return () => document.removeEventListener("dblclick", onDoubleClick);
}
