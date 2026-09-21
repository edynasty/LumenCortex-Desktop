import type { ReactNode } from "react";

type Props = {
  label: string;
  children: ReactNode;
};

export function Tooltip({ label, children }: Props) {
  return (
    <span className="desktop-tooltip">
      {children}
      <span className="desktop-tooltip-content" role="tooltip">{label}</span>
    </span>
  );
}
