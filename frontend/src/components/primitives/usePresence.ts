import { useEffect, useState } from "react";

/** Exit length in ms from the `--dur-fast` token, so reduced motion (1ms) and the CSS agree. */
function exitMs(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--dur-fast").trim();
  const value = parseFloat(raw);
  if (Number.isNaN(value)) return 120;
  return raw.endsWith("ms") ? value : value * 1000;
}

/**
 * Keeps a dismissed layer (dialog, drawer, toast) mounted for its exit motion.
 *
 * `present` is false only after the exit has played; `state` drives `data-state` so CSS can run the
 * enter and exit animations. Reopening during the exit cancels it. Callers pass the real `open` to
 * focus handling so focus returns and Escape stops the moment the layer is dismissed, not after.
 */
export function usePresence(open: boolean) {
  const [lingering, setLingering] = useState(open);
  // Adjusting state while rendering is the supported way to derive "mounted" from a prop change.
  if (open && !lingering) setLingering(true);

  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => setLingering(false), exitMs());
    return () => window.clearTimeout(timer);
  }, [open]);

  return { present: open || lingering, state: open ? ("open" as const) : ("closed" as const) };
}
