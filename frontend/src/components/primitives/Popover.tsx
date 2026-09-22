import { ReactNode, type KeyboardEvent as ReactKeyboardEvent, type RefObject, useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  ariaLabel: string;
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  onTriggerKeyDown?: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
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
  triggerRef,
  onTriggerKeyDown,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const internalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const activeTriggerRef = triggerRef || internalTriggerRef;

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
        requestAnimationFrame(() => activeTriggerRef.current?.focus());
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activeTriggerRef, open, onOpenChange]);

  return (
    <div className="desktop-popover" ref={rootRef}>
      <button
        ref={activeTriggerRef}
        type="button"
        className={triggerClassName}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onKeyDown={onTriggerKeyDown}
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
