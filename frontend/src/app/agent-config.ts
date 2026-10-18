import type { AgentConfig, Delegation } from "../types";

export type AgentPolicy = "read-only" | "workspace" | "full";

// modelRef is set only when the user intentionally chose a model. Absent, Core keeps the session's
// pinned model, or picks Effective.Model for a session that has none. delegation is the thread's grant
// as the user set it; Core validates and enforces it for this Start only.
export function buildAgentConfig(
  modelRef: string | undefined,
  policy: AgentPolicy,
  maxSteps: number,
  delegation: Delegation = "none",
): AgentConfig {
  return {
    modelRef,
    policy,
    maxSteps,
    maxToolCallsPerStep: 8,
    delegation,
  };
}
