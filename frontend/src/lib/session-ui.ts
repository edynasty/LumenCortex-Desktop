import type { Session } from "../types";

export type SessionUI = {
  title: string;
  pinned: boolean;
  archived: boolean;
  parentSessionId?: string;
};

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

export function sessionUI(session: Session): SessionUI {
  const metadata = object(session.metadata);
  const ui = object(metadata?.ui);
  const subagent = object(metadata?.subagent);
  return {
    title: typeof ui?.title === "string" && ui.title.trim() ? ui.title.trim() : session.goal,
    pinned: ui?.pinned === true,
    archived: ui?.archived === true,
    parentSessionId: typeof subagent?.parentSessionId === "string" ? subagent.parentSessionId : undefined,
  };
}
