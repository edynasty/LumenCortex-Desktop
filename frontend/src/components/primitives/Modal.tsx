import { useRef, type ReactNode } from "react";
import { useFocusTrap } from "./useFocusTrap";

/**
 * Window-level sheet (settings, command palette). Rendered inside `.lc-window` so it is sized
 * by the window container, not the document.
 */
export function Modal({ label, onClose, className = "", hidden, children }: {
  label: string;
  onClose: () => void;
  className?: string;
  /** Keeps the sheet mounted (unsaved edits survive) while it is closed. */
  hidden?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, !hidden, onClose);
  return (
    <div className="modal-layer" hidden={hidden} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={`modal ${className}`.trim()}>
        {children}
      </div>
    </div>
  );
}
