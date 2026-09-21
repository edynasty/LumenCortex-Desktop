import type { Session, SessionRuntime } from "../types";

function object(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return object(parsed);
    } catch {
      return null;
    }
  }
  return null;
}

export function sessionRuntime(session: Session, workspace: string): SessionRuntime {
  const metadata = object(session.metadata);
  const runtime = object(metadata?.runtime);
  if (runtime?.kind === "worktree" && typeof runtime.path === "string") {
    return {
      kind: "worktree",
      path: runtime.path,
      branch: typeof runtime.branch === "string" ? runtime.branch : undefined,
      base: typeof runtime.base === "string" ? runtime.base : undefined,
      head: typeof runtime.head === "string" ? runtime.head : undefined,
    };
  }
  return {
    kind: "local",
    path: workspace,
  };
}
