import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ReactNode;
  active?: boolean;
  size?: "sm" | "md";
};

export function IconButton({ label, icon, active, size = "md", className = "", type = "button", ...props }: Props) {
  return (
    <button
      {...props}
      type={type}
      className={`icon-btn ${size === "sm" ? "is-sm" : ""} ${active ? "is-active" : ""} ${className}`.replace(/\s+/g, " ").trim()}
      aria-label={label}
      title={props.title ?? label}
      aria-pressed={active}
    >
      {icon}
    </button>
  );
}
