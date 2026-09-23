import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover } from "./Popover";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  group?: string;
  badge?: string;
  keywords?: string;
};

type SearchConfig = {
  ariaLabel: string;
  placeholder: string;
  emptyLabel: string;
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
  popoverPlacement?: "top" | "bottom";
  search?: SearchConfig;
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
  popoverPlacement = "top",
  search,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusTarget, setFocusTarget] = useState<"first" | "last" | "selected" | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!search || !normalized) return options;
    return options.filter((option) =>
      [
        option.label,
        option.value,
        option.group,
        option.description,
        option.keywords,
      ].some((item) => item?.toLowerCase().includes(normalized)),
    );
  }, [options, query, search]);

  useEffect(() => {
    if (!open || focusTarget) return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, focusTarget, Boolean(search)]);

  useEffect(() => {
    if (!open || !focusTarget) return;
    const frame = requestAnimationFrame(() => {
      const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') || []);
      if (!items.length) return;
      const selectedIndex = Math.max(0, filteredOptions.findIndex((option) => option.value === value));
      const index =
        focusTarget === "last"
          ? items.length - 1
          : focusTarget === "selected"
            ? Math.min(selectedIndex, items.length - 1)
            : 0;
      items[index]?.focus();
      setFocusTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [filteredOptions, focusTarget, open, value]);

  function setOpenState(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setFocusTarget(null);
    }
  }

  function closeAndRestoreFocus() {
    setOpenState(false);
    triggerRef.current?.focus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setFocusTarget(event.key === "ArrowUp" ? "last" : "selected");
      setOpen(true);
    }
  }

  function focusOption(direction: "first" | "last") {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') || []);
    items[direction === "last" ? items.length - 1 : 0]?.focus();
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(event.key === "ArrowUp" ? "last" : "first");
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
      onOpenChange={setOpenState}
      ariaLabel={ariaLabel}
      disabled={disabled}
      placement={popoverPlacement}
      triggerRef={triggerRef}
      onTriggerKeyDown={onTriggerKeyDown}
      triggerClassName={`desktop-select-trigger ${className}`}
      contentClassName={`desktop-select-popover ${search ? "searchable" : ""}`}
      trigger={
        <>
          <span className="desktop-select-trigger-copy">
            <span>{selected?.label || placeholder}</span>
            {selected?.badge && <em>{selected.badge}</em>}
            {showDescriptionInTrigger && selected?.description && <small>{selected.description}</small>}
          </span>
          <ChevronDown size={13} strokeWidth={1.7} aria-hidden />
        </>
      }
    >
      {search && (
        <label className="desktop-select-search">
          <Search size={12} strokeWidth={1.8} aria-hidden />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKeyDown}
            aria-label={search.ariaLabel}
            placeholder={search.placeholder}
            autoComplete="off"
          />
        </label>
      )}
      <div
        ref={listRef}
        className="desktop-select-list"
        role="listbox"
        aria-label={ariaLabel}
        onKeyDown={onListKeyDown}
      >
        {filteredOptions.map((option, index) => {
          const previousGroup = index > 0 ? filteredOptions[index - 1].group : undefined;
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
                  <span className="desktop-select-option-title">
                    <strong>{option.label}</strong>
                    {option.badge && <em>{option.badge}</em>}
                  </span>
                  {option.description && <small>{option.description}</small>}
                </span>
              </button>
            </div>
          );
        })}
        {search && filteredOptions.length === 0 && (
          <div className="desktop-select-empty">{search.emptyLabel}</div>
        )}
      </div>
    </Popover>
  );
}
