import { ReactNode, useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  ariaLabel: string;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
};

export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  ariaLabel,
  triggerClassName = "",
  contentClassName = "",
  disabled = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div className="desktop-popover" ref={rootRef}>
      <button
        type="button"
        className={triggerClassName}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        {trigger}
      </button>
      {open && (
        <div className={`desktop-popover-content ${contentClassName}`} role="presentation">
          {children}
        </div>
      )}
    </div>
  );
}
