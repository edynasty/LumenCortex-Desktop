import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnchoredPopover } from "../primitives/AnchoredPopover";
import { Icon } from "../primitives/Icon";
import type { PickerOption } from "./ComposerPickers";
import "./composer.css";

type PickerProps = {
  ariaLabel: string;
  value: string;
  options: PickerOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
};

/**
 * A compact chip that opens a radio menu (mode, policy, runtime, delegation, recent projects). The
 * options carry their own icon and a description line under the name. Opening (click, Enter, Space,
 * ArrowDown or ArrowUp on the chip) moves focus to the checked option; arrow keys move through the
 * menu, Enter picks, Esc closes and returns focus to the chip.
 */
export function MenuPicker({ ariaLabel, value, options, placeholder, disabled, disabledReason, collapsible, placement = "above-start", onChange }: PickerProps & {
  placeholder: string;
  /** Narrow composers show only the icon; the accessible name still carries the choice. */
  collapsible?: boolean;
  /** Why the control is capped (Ask mode); shown on the disabled chip. */
  disabledReason?: string;
  /** Right-side controls anchor their menu to the right edge so it stays in the viewport. */
  placement?: "above-start" | "above-end";
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  // Focus goes into the menu on open (the checked option, else the first) and back to the chip on
  // close, so Esc or a pick keeps the toolbar keyboard flow.
  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not([disabled])');
    const checked = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]:not([disabled])');
    (checked ?? items?.[0])?.focus();
    return () => triggerRef.current?.focus();
  }, [open]);

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (open || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    setOpen(true);
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not([disabled])')];
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = current < 0 ? 0 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0].focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1].focus();
    }
  };

  return (
    <span className="popover-anchor">
      <button
        ref={triggerRef}
        type="button"
        className={`chip${collapsible ? " is-collapsible" : ""}`}
        title={disabled && disabledReason ? disabledReason : collapsible ? selected?.label ?? placeholder : undefined}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${selected?.label ?? placeholder}`}
      >
        {selected?.icon && <Icon name={selected.icon} size={14} />}
        <span className="chip-label">{selected?.label ?? placeholder}</span>
        <Icon name="collapse" size={12} className="chip-caret" />
      </button>
      <AnchoredPopover open={open} onClose={() => setOpen(false)} placement={placement} label={ariaLabel} className="option-menu">
        <div ref={menuRef} className="menu" role="menu" aria-label={ariaLabel} onKeyDown={onMenuKeyDown}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              className="menu-item"
              onClick={() => {
                setOpen(false);
                onChange(option.value);
              }}
            >
              {option.icon && <Icon name={option.icon} size={15} />}
              <span className="menu-item-body">
                <span>{option.label}</span>
                {option.description && <span className="menu-item-sub">{option.description}</span>}
              </span>
              {option.value === value && <Icon name="checkmark" size={14} className="menu-check" />}
            </button>
          ))}
        </div>
      </AnchoredPopover>
    </span>
  );
}
