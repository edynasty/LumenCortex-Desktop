import { GitBranch, HardDrive } from "lucide-react";
import type { SessionRuntime } from "../../types";

type Props = {
  runtime: SessionRuntime;
  localLabel: string;
  worktreeLabel: string;
  compact?: boolean;
};

export function RuntimeIdentity({ runtime, localLabel, worktreeLabel, compact = false }: Props) {
  if (runtime.kind === "worktree") {
    return (
      <span className={`runtime-identity worktree ${compact ? "compact" : ""}`} title={runtime.path}>
        <GitBranch size={compact ? 11 : 12} strokeWidth={1.7} aria-hidden />
        <span>{worktreeLabel}</span>
        {runtime.branch && <code>{runtime.branch}</code>}
        {!compact && runtime.base && <small>base {runtime.base}</small>}
        {!compact && runtime.path && <small className="runtime-path">{runtime.path}</small>}
      </span>
    );
  }
  return (
    <span className={`runtime-identity local ${compact ? "compact" : ""}`} title={runtime.path}>
      <HardDrive size={compact ? 11 : 12} strokeWidth={1.7} aria-hidden />
      <span>{localLabel}</span>
    </span>
  );
}
