import { useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { useFocusTrap } from "./useFocusTrap";
import { usePresence } from "./usePresence";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  onOpenChange: (open: boolean) => void;
  footer?: ReactNode;
  closeLabel?: string;
};

/**
 * Confirmation / small form dialog on float glass, centred over the window. Dismissing plays a short
 * exit; the content is frozen at its last open value meanwhile, so a parent that clears its target
 * does not blank the dialog mid-exit, and the layer is inert so nothing in it can be pressed.
 */
export function Dialog(props: Props) {
  const { open, onOpenChange, closeLabel = "Close" } = props;
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const { present, state } = usePresence(open);
  const lastOpen = useRef(props);
  if (open) lastOpen.current = props;
  const { title, description, children, footer } = open ? props : lastOpen.current;
  useFocusTrap(dialogRef, open, () => onOpenChange(false));

  if (!present) return null;

  return createPortal(
    <div className="modal-layer is-fixed" data-state={state} {...(open ? {} : { inert: "" })} onMouseDown={(event) => event.target === event.currentTarget && onOpenChange(false)}>
      <div
        ref={dialogRef}
        className="modal dialog"
        data-state={state}
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
