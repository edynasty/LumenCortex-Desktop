import type { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
};

export function EmptyState({ icon, title, body, action, compact = false }: Props) {
  return (
    <div className={`desktop-empty-state ${compact ? "compact" : ""}`}>
      {icon && <div className="desktop-empty-icon" aria-hidden>{icon}</div>}
      <strong>{title}</strong>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}
