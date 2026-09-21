import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  icon?: ReactNode;
};

export function Button({ variant = "secondary", icon, className = "", children, ...props }: Props) {
  return (
    <button {...props} className={`desktop-button ${variant} ${className}`.trim()}>
      {icon}
      {children}
    </button>
  );
}
