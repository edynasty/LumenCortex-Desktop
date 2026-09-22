import { useMemo, useState } from "react";
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
  const selected = useMemo(() => options.find((option) => option.value === value), [options, value]);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      ariaLabel={ariaLabel}
      disabled={disabled}
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
      <div className="desktop-select-list" role="listbox" aria-label={ariaLabel}>
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
                  setOpen(false);
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
