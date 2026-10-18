import type { Delegation, Session } from "../types";
import { delegationOf } from "./execution-tasks";

export type SessionUI = {
  title: string;
  pinned: boolean;
  archived: boolean;
  // The thread's start_task grant as the user set it; "none" when unset.
  delegation: Delegation;
  parentSessionId?: string;
  // The child relation: "execution" for an execution task, else a read-only subagent.
  childMode?: string;
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
  const parentSessionId = typeof subagent?.parentSessionId === "string" ? subagent.parentSessionId : undefined;
  return {
    title: typeof ui?.title === "string" && ui.title.trim() ? ui.title.trim() : session.goal,
    pinned: ui?.pinned === true,
    archived: ui?.archived === true,
    // A child never holds a grant: Core strips it at every Start of a child.
    delegation: parentSessionId ? "none" : delegationOf(ui?.delegation),
    parentSessionId,
    childMode: parentSessionId ? (typeof subagent?.mode === "string" ? subagent.mode : "subagent") : undefined,
  };
}
