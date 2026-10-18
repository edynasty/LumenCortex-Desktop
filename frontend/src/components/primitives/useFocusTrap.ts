import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal focus contract shared by dialogs, sheets and drawers: focus moves inside on open
 * (an `autofocus` / `data-autofocus` element first), Tab cycles within, Escape closes, and focus
 * returns to the opener on close.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const items = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const preferred = ref.current?.querySelector<HTMLElement>("[autofocus], [data-autofocus]");
    (preferred ?? items()[0] ?? ref.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      // Only the layer holding focus reacts, so a dialog over a sheet closes alone.
      const active = document.activeElement;
      if (active && active !== document.body && !ref.current?.contains(active)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const list = items();
      if (!list.length) {
        event.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [open, ref]);
}
