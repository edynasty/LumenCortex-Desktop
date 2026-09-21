import type { ReactNode } from "react";
import { useEffect } from "react";

type Props = {
  open: boolean;
  side?: "left" | "right";
  label: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
};

export function Drawer({ open, side = "right", label, children, onOpenChange }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="desktop-drawer-layer" role="presentation">
      <button
        className="desktop-drawer-backdrop"
        type="button"
        aria-label={`Close ${label}`}
        onClick={() => onOpenChange(false)}
      />
      <aside className={`desktop-drawer ${side}`} aria-label={label}>
        {children}
      </aside>
    </div>
  );
}
