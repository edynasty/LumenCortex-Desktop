import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { useFocusTrap } from "./useFocusTrap";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  onOpenChange: (open: boolean) => void;
  footer?: ReactNode;
  closeLabel?: string;
};

/** Confirmation / small form dialog on float glass, centred over the window. */
export function Dialog({ open, title, description, children, onOpenChange, footer, closeLabel = "Close" }: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, open, () => onOpenChange(false));

  if (!open) return null;

  return createPortal(
    <div className="modal-layer is-fixed" onMouseDown={(event) => event.target === event.currentTarget && onOpenChange(false)}>
      <div
        ref={dialogRef}
        className="modal dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div className="dialog-head">
          <h2 id={titleId} className="dialog-title">{title}</h2>
          <button type="button" className="icon-btn is-sm" aria-label={closeLabel} title={closeLabel} onClick={() => onOpenChange(false)}>
            <Icon name="close" size={14} />
          </button>
        </div>
        {description && <p id={descriptionId} className="dialog-lede">{description}</p>}
        {children && <div className="dialog-body">{children}</div>}
        {footer && <div className="dialog-actions">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
