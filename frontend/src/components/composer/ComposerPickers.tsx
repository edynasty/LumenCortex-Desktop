import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnchoredPopover } from "../primitives/AnchoredPopover";
import { Icon } from "../primitives/Icon";
import type { IconName } from "../primitives/icons";
import "./composer.css";

/** One pickable value; `group` draws a provider label above its rows. */
export type PickerOption = {
  value: string;
  label: string;
  description?: string;
  group?: string;
  badge?: string;
  badgeTone?: "default" | "warning";
  icon?: IconName;
  // A visible but unselectable row (missing provider key, no tool calling); `disabledReason` says why.
  disabled?: boolean;
  disabledReason?: string;
};

/** The search matches the name, the provider/model ref and the metadata line (upstream model id). */
export function filterPickerOptions(options: PickerOption[], query: string): PickerOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((option) =>
    `${option.label} ${option.value} ${option.group ?? ""} ${option.description ?? ""}`.toLowerCase().includes(q),
  );
}

/** Consecutive options sharing a `group` fold under one header, preserving the catalog's order. */
export function groupPickerOptions(options: PickerOption[]): { group?: string; options: PickerOption[] }[] {
  const byGroup: { group?: string; options: PickerOption[] }[] = [];
  for (const option of options) {
    const last = byGroup[byGroup.length - 1];
    if (last && last.group === option.group) last.options.push(option);
    else byGroup.push({ group: option.group, options: [option] });
  }
  return byGroup;
}

// The picker's flat, navigable rows: a Recent group first (bounded, most recent first, only options
// the filter still shows), then the provider groups.
export type PickerGroup = { key: string; label?: string; options: PickerOption[] };

export function pickerGroups(
  filtered: PickerOption[],
  recentRefs: string[],
  recentLabel: string,
): PickerGroup[] {
  const recent = recentRefs
    .map((ref) => filtered.find((option) => option.value === ref))
    .filter((option): option is PickerOption => Boolean(option));
  const groups: PickerGroup[] = recent.length
    ? [{ key: "recent", label: recentLabel, options: recent }]
    : [];
  for (const { group, options } of groupPickerOptions(filtered)) {
    groups.push({ key: `group-${group ?? ""}`, label: group, options });
  }
  return groups;
}

type PickerProps = {
  ariaLabel: string;
  value: string;
  options: PickerOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
};

/** One row per group with a stable DOM id for aria-activedescendant and keyboard navigation. */
function pickerEntries(groups: PickerGroup[], listId: string): { id: string; option: PickerOption }[] {
  return groups.flatMap((group, groupIndex) =>
    group.options.map((option, optionIndex) => ({ id: `${listId}-${groupIndex}-${optionIndex}`, option })),
  );
}

export type ModelPickerHandle = { open: () => void };

/**
 * The model picker: a composer chip that opens a searchable, provider-grouped list. Type filters
 * (name, ref, provider, metadata), arrows + Enter pick, Esc closes and returns focus to the chip.
 * The chip carries the missing-key warning and a pending marker for a choice not yet sent; models
 * the app must refuse (no key, no tool calling) stay visible but disabled with their reason.
 */
export const ModelPicker = forwardRef<ModelPickerHandle, PickerProps & {
  placeholder: string;
  searchLabel: string;
  emptyLabel: string;
  recentLabel: string;
  recentRefs: string[];
  pendingLabel?: string;
  /** Optional footer row (e.g. "Manage providers"); rendered inside the popover. */
  footer?: { label: string; onSelect: () => void };
}>(function ModelPicker(
  {
    ariaLabel,
    value,
    options,
    placeholder,
    searchLabel,
    emptyLabel,
    recentLabel,
    recentRefs,
    pendingLabel,
    disabled,
    onChange,
    footer,
  },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => filterPickerOptions(options, query), [options, query]);
  const groups = useMemo(() => pickerGroups(filtered, recentRefs, recentLabel), [filtered, recentRefs, recentLabel]);
  const entries = useMemo(() => pickerEntries(groups, listId), [groups, listId]);
  // Keyboard navigation skips disabled rows; they stay visible with their reason.
  const enabledIndexes = useMemo(
    () => entries.map((entry, index) => (entry.option.disabled ? -1 : index)).filter((index) => index >= 0),
    [entries],
  );

  // The active row stays visible while arrows walk the list.
  useEffect(() => {
    const index = enabledIndexes[activeIndex];
    if (index === undefined) return;
    document.getElementById(entries[index].id)?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, enabledIndexes, entries]);

  useImperativeHandle(ref, () => ({
    open: () => {
      if (disabled) return;
      setQuery("");
      setActiveIndex(-1);
      setOpen(true);
    },
  }), [disabled]);

  // Opening resets the search and focuses it; closing (Esc, outside press, selection) returns
  // focus to the chip so the keyboard flow never falls into the transcript.
  useEffect(() => {
    if (!open) return;
    setActiveIndex(-1);
    setQuery("");
    searchRef.current?.focus();
    return () => triggerRef.current?.focus();
  }, [open]);


  const select = (next: string) => {
    setOpen(false);
    onChange(next);
  };

  const moveActive = (delta: number) => {
    if (!enabledIndexes.length) return;
    const current = enabledIndexes.indexOf(activeIndex);
    const next = current < 0 ? 0 : (current + delta + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[next]);
  };

  const onSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      // From the input (no active row) ArrowDown lands on the first enabled row.
      moveActive(activeIndex < 0 ? 0 : event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home") {
      event.preventDefault();
      if (enabledIndexes.length) setActiveIndex(enabledIndexes[0]);
    } else if (event.key === "End") {
      event.preventDefault();
      if (enabledIndexes.length) setActiveIndex(enabledIndexes[enabledIndexes.length - 1]);
    } else if (event.key === "Enter") {
      event.preventDefault();
      // Enter with no row walked to yet picks the first enabled match.
      const index = activeIndex < 0 ? enabledIndexes[0] : enabledIndexes[activeIndex];
      const entry = index !== undefined ? entries[index] : undefined;
      if (entry) select(entry.option.value);
    }
  };

  return (
    <span className="popover-anchor">
      <button
        ref={triggerRef}
        type="button"
        className={`chip model-chip ${selected?.badgeTone === "warning" ? "is-warn" : ""}`}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${selected?.label ?? placeholder}`}
        title={selected?.value ?? value}
      >
        <Icon name="model" size={14} />
        <span className="chip-label">{selected?.label ?? placeholder}</span>
        {pendingLabel && <span className="tag is-pending">{pendingLabel}</span>}
        <Icon name="collapse" size={12} className="chip-caret" />
      </button>
      <AnchoredPopover open={open} onClose={() => setOpen(false)} placement="above-end" label={ariaLabel} className="model-popover">
        <div className="search-field model-search">
          <Icon name="search" size={14} />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={onSearchKeyDown}
            placeholder={searchLabel}
            aria-label={searchLabel}
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={entries[enabledIndexes[activeIndex] ?? -1]?.id}
          />
        </div>
        <div className="model-list" role="listbox" aria-label={ariaLabel} id={listId}>
          {groups.length === 0 && <p className="popover-empty">{emptyLabel}</p>}
          {groups.map((group) => (
            <div key={group.key} className="model-group">
              {group.label && <div className="menu-label">{group.label}</div>}
              {group.options.map((option) => {
                const index = entries.findIndex((entry) => entry.option === option);
                const isActive = enabledIndexes[activeIndex] === index;
                return (
                  <button
                    key={`${group.key}-${option.value}`}
                    id={entries[index]?.id}
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    aria-disabled={option.disabled || undefined}
                    className={`model-row ${option.value === value ? "is-selected" : ""} ${isActive ? "is-active" : ""}`}
                    disabled={option.disabled}
                    title={option.disabled ? option.disabledReason : undefined}
                    onClick={() => select(option.value)}
                  >
                    <span className="model-row-main">
                      <span className="model-row-name">
                        {option.label}
                        {option.badge && <span className={`tag ${option.badgeTone === "warning" ? "is-warn" : ""}`}>{option.badge}</span>}
                      </span>
                      <span className="model-row-ref mono">{option.description || option.value}</span>
                      {option.disabled && option.disabledReason && (
                        <span className="model-row-reason">{option.disabledReason}</span>
                      )}
                    </span>
                    {option.value === value && <Icon name="checkmark" size={14} className="menu-check" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {footer && (
          <button
            type="button"
            className="popover-footer-link"
            onClick={() => {
              setOpen(false);
              footer.onSelect();
            }}
          >
            <Icon name="tune" size={14} />
            {footer.label}
          </button>
        )}
      </AnchoredPopover>
    </span>
  );
});
