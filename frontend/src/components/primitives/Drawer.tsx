import { useRef, type ReactNode } from "react";
import { useFocusTrap } from "./useFocusTrap";
import { usePresence } from "./usePresence";

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
  const { present, state } = usePresence(open);
  useFocusTrap(drawerRef, open, () => onOpenChange(false));

  if (!present) return null;
  // While the exit plays the layer is inert and ignores the pointer, so a second press cannot reopen it.
  const dismissed = open ? {} : { inert: "" };
  return (
    <>
      <button className="scrim" type="button" tabIndex={-1} data-state={state} {...dismissed} aria-label={closeLabel} onClick={() => onOpenChange(false)} />
      {/* Focus is trapped while open, so assistive tech gets modal dialog semantics. */}
      <aside ref={drawerRef} className={`drawer drawer-${side === "left" ? "start" : "end"} ${className}`.trim()} data-state={state} {...dismissed} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </aside>
    </>
  );
}
