import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover } from "./Popover";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  group?: string;
};

type Props = {
  ariaLabel: string;
  value: string;
  options: SelectOption[];
  placeholder: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  showDescriptionInTrigger?: boolean;
};

export function DesktopSelect({
  ariaLabel,
  value,
  options,
  placeholder,
  onChange,
  className = "",
  disabled = false,
  showDescriptionInTrigger = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState<"first" | "last" | "selected" | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);

  useEffect(() => {
    if (!open || !focusTarget) return;
    requestAnimationFrame(() => {
      const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') || []);
      if (!items.length) return;
      const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
      const index =
        focusTarget === "last"
          ? items.length - 1
          : focusTarget === "selected"
            ? Math.min(selectedIndex, items.length - 1)
            : 0;
      items[index]?.focus();
      setFocusTarget(null);
    });
  }, [focusTarget, open, options, value]);

  function closeAndRestoreFocus() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setFocusTarget(event.key === "ArrowUp" ? "last" : "selected");
      setOpen(true);
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') || []);
    if (!items.length) return;
    event.preventDefault();
    const current = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      ariaLabel={ariaLabel}
      disabled={disabled}
      triggerRef={triggerRef}
      onTriggerKeyDown={onTriggerKeyDown}
      triggerClassName={`desktop-select-trigger ${className}`}
      contentClassName="desktop-select-popover"
      trigger={
        <>
          <span className="desktop-select-trigger-copy">
            <span>{selected?.label || placeholder}</span>
            {showDescriptionInTrigger && selected?.description && <small>{selected.description}</small>}
          </span>
          <ChevronDown size={13} strokeWidth={1.7} aria-hidden />
        </>
      }
    >
      <div
        ref={listRef}
        className="desktop-select-list"
        role="listbox"
        aria-label={ariaLabel}
        onKeyDown={onListKeyDown}
      >
        {options.map((option, index) => {
          const previousGroup = index > 0 ? options[index - 1].group : undefined;
          const showGroup = Boolean(option.group && option.group !== previousGroup);
          const selectedOption = option.value === value;
          return (
            <div className="desktop-select-option-wrap" key={option.value}>
              {showGroup && <div className="desktop-select-group">{option.group}</div>}
              <button
                type="button"
                role="option"
                aria-selected={selectedOption}
                className={`desktop-select-option ${selectedOption ? "selected" : ""}`}
                onClick={() => {
                  onChange(option.value);
                  closeAndRestoreFocus();
                }}
              >
                <span className="desktop-select-check">
                  {selectedOption && <Check size={12} strokeWidth={2} aria-hidden />}
                </span>
                <span className="desktop-select-option-copy">
                  <strong>{option.label}</strong>
                  {option.description && <small>{option.description}</small>}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </Popover>
  );
}
