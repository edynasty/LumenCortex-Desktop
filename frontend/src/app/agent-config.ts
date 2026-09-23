import type { AgentConfig } from "../types";

export type AgentPolicy = "read-only" | "workspace" | "full";

export function buildAgentConfig(
  modelRef: string,
  policy: AgentPolicy,
  maxSteps: number,
): AgentConfig {
  return {
    provider: {},
    modelRef: modelRef || undefined,
    policy,
    maxSteps,
    recentMessages: 12,
    maxToolCallsPerStep: 8,
  };
}
