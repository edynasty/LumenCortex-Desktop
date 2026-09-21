import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ReactNode;
};

export function IconButton({ label, icon, className = "", ...props }: Props) {
  return (
    <button {...props} className={`desktop-icon-button ${className}`.trim()} aria-label={label}>
      {icon}
    </button>
  );
}
