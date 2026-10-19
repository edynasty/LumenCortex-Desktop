import { useMemo, useState } from "react";
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
};

type PickerProps = {
  ariaLabel: string;
  value: string;
  options: PickerOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
};

/**
 * The model picker: a composer chip that opens a searchable, provider-grouped list. The chip
 * carries the missing-key warning of the selected model; the popover keeps every configured
 * model reachable without leaving the composer.
 */
export function ModelPicker({
  ariaLabel,
  value,
  options,
  placeholder,
  searchLabel,
  emptyLabel,
  disabled,
  onChange,
  footer,
}: PickerProps & {
  placeholder: string;
  searchLabel: string;
  emptyLabel: string;
  /** Optional footer row (e.g. "Manage providers"); rendered inside the popover. */
  footer?: { label: string; onSelect: () => void };
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = options.filter((option) => !q || `${option.label} ${option.value} ${option.group ?? ""}`.toLowerCase().includes(q));
    const byGroup: { group?: string; options: PickerOption[] }[] = [];
    for (const option of list) {
      const last = byGroup[byGroup.length - 1];
      if (last && last.group === option.group) last.options.push(option);
      else byGroup.push({ group: option.group, options: [option] });
    }
    return byGroup;
  }, [options, query]);

  const select = (next: string) => {
    setOpen(false);
    onChange(next);
  };

  return (
    <span className="popover-anchor">
      <button
        type="button"
        className={`chip ${selected?.badgeTone === "warning" ? "is-warn" : ""}`}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${selected?.label ?? placeholder}`}
        title={selected?.value ?? value}
      >
        <Icon name="model" size={14} />
        <span className="chip-label">{selected?.label ?? placeholder}</span>
        <Icon name="collapse" size={12} className="chip-caret" />
      </button>
      <AnchoredPopover open={open} onClose={() => setOpen(false)} placement="above-start" label={ariaLabel} className="model-popover">
        <div className="search-field model-search">
          <Icon name="search" size={14} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchLabel}
            aria-label={searchLabel}
          />
        </div>
        <div className="model-list" role="listbox" aria-label={ariaLabel}>
          {groups.length === 0 && <p className="popover-empty">{emptyLabel}</p>}
          {groups.map(({ group, options: list }) => (
            <div key={group ?? ""} className="model-group">
              {group && <div className="menu-label">{group}</div>}
              {list.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={`model-row ${option.value === value ? "is-selected" : ""}`}
                  onClick={() => select(option.value)}
                >
                  <span className="model-row-main">
                    <span className="model-row-name">
                      {option.label}
                      {option.badge && <span className={`tag ${option.badgeTone === "warning" ? "is-warn" : ""}`}>{option.badge}</span>}
                    </span>
                    <span className="model-row-ref mono">{option.description || option.value}</span>
                  </span>
                  {option.value === value && <Icon name="checkmark" size={14} className="menu-check" />}
                </button>
              ))}
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
}

/**
 * A compact chip that opens a radio menu (policy, runtime, delegation, recent projects).
 * The options carry their own icon and a description line under the name.
 */
export function MenuPicker({ ariaLabel, value, options, placeholder, disabled, collapsible, onChange }: PickerProps & {
  placeholder: string;
  /** Narrow composers show only the icon; the accessible name still carries the choice. */
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <span className="popover-anchor">
      <button
        type="button"
        className={`chip${collapsible ? " is-collapsible" : ""}`}
        title={collapsible ? selected?.label ?? placeholder : undefined}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${selected?.label ?? placeholder}`}
      >
        {selected?.icon && <Icon name={selected.icon} size={14} />}
        <span className="chip-label">{selected?.label ?? placeholder}</span>
        <Icon name="collapse" size={12} className="chip-caret" />
      </button>
      <AnchoredPopover open={open} onClose={() => setOpen(false)} placement="above-start" label={ariaLabel} className="option-menu">
        <div className="menu" role="menu" aria-label={ariaLabel}>
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
