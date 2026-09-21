import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ label, hint, error, id, className = "", ...props }: Props) {
  const inputId = id || `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const descriptionId = `${inputId}-description`;
  return (
    <label className={`desktop-text-field ${className}`.trim()} htmlFor={inputId}>
      <span>{label}</span>
      <input
        {...props}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={hint || error ? descriptionId : undefined}
      />
      {(error || hint) && <small id={descriptionId} className={error ? "error" : ""}>{error || hint}</small>}
    </label>
  );
}
