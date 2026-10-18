import { useRef, type ReactNode } from "react";
import { useFocusTrap } from "./useFocusTrap";

type Props = {
  open: boolean;
  side?: "left" | "right";
  label: string;
  closeLabel?: string;
  className?: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
};

/** Sidebar / inspector as a glass drawer over a scrim on narrow windows. */
export function Drawer({ open, side = "right", label, closeLabel = `Close ${label}`, className = "", children, onOpenChange }: Props) {
  const drawerRef = useRef<HTMLElement>(null);
  useFocusTrap(drawerRef, open, () => onOpenChange(false));

  if (!open) return null;
  return (
    <>
      <button className="scrim" type="button" tabIndex={-1} aria-label={closeLabel} onClick={() => onOpenChange(false)} />
      <aside ref={drawerRef} className={`drawer drawer-${side === "left" ? "start" : "end"} ${className}`.trim()} aria-label={label}>
        {children}
      </aside>
    </>
  );
}
