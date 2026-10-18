import { useEffect, useRef, type ReactNode } from "react";

/**
 * Popover anchored to its parent `.popover-anchor` (position: relative). Closes on a press
 * outside the anchor and on Escape. The trigger lives in the anchor and owns aria-expanded.
 */
export function AnchoredPopover({ open, onClose, placement = "below-start", label, className = "", children }: {
  open: boolean;
  onClose: () => void;
  placement?: "below-start" | "below-end" | "above-start" | "above-end";
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const anchor = ref.current?.parentElement;
      if (anchor && !anchor.contains(event.target as Node)) closeRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeRef.current();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div ref={ref} role="dialog" aria-label={label} className={`popover popover-${placement} ${className}`.trim()}>
      {children}
    </div>
  );
}
