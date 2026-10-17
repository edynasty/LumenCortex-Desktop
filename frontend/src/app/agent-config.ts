import type { AgentConfig } from "../types";

export type AgentPolicy = "read-only" | "workspace" | "full";

// modelRef is set only when the user intentionally chose a model. Absent, Core keeps the session's
// pinned model, or picks Effective.Model for a session that has none.
export function buildAgentConfig(
  modelRef: string | undefined,
  policy: AgentPolicy,
  maxSteps: number,
): AgentConfig {
  return {
    modelRef,
    policy,
    maxSteps,
    maxToolCallsPerStep: 8,
  };
}
