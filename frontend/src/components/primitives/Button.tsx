import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md";
  icon?: ReactNode;
};

export function Button({ variant = "secondary", size = "md", icon, className = "", children, type = "button", ...props }: Props) {
  return (
    <button {...props} type={type} className={`btn btn-${variant} btn-${size} ${className}`.trim()}>
      {icon}
      {children}
    </button>
  );
}
