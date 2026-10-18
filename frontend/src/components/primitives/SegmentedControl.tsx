import type { ReactNode } from "react";

type Option<T extends string> = { value: T; label: ReactNode; title?: string };

type Props<T extends string> = {
  value: T;
  options: Option<T>[];
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ value, options, ariaLabel, size = "md", className = "", onChange }: Props<T>) {
  return (
    <div className={`segmented segmented-${size} ${className}`.trim()} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          aria-label={option.title}
          title={option.title}
          className={value === option.value ? "is-on" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
