import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  side?: "left" | "right";
  label: string;
  closeLabel?: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
};

export function Drawer({
  open,
  side = "right",
  label,
  closeLabel = `Close ${label}`,
  children,
  onOpenChange,
}: Props) {
  const drawerRef = useRef<HTMLElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || []
      );

    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChangeRef.current(false);
        return;
      }
      if (event.key !== "Tab") return;

      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
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
  }, [open]);

  if (!open) return null;

  return (
    <div className="desktop-drawer-layer" role="presentation">
      <button
        className="desktop-drawer-backdrop"
        type="button"
        aria-label={closeLabel}
        onClick={() => onOpenChange(false)}
      />
      <aside ref={drawerRef} className={`desktop-drawer ${side}`} aria-label={label}>
        {children}
      </aside>
    </div>
  );
}
