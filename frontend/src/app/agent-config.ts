import type { AgentConfig, AgentEffort, Delegation } from "../types";

export type AgentPolicy = "read-only" | "workspace" | "full";
export type AgentMode = "ask" | "agent";

export type TurnControls = {
  policy: AgentPolicy;
  delegation: Delegation;
};

// The composer's Ask/Agent switch, mapped once. Ask is a read-only conversation turn: it never
// widens permissions, so it forces Core's read-only policy (read/search/inspect only) and no
// delegation regardless of what the user chose elsewhere. Agent keeps the user's own policy and
// delegation grant unchanged. The Desktop backend guard applies the same cap after the bridge.
export function resolveTurnOptions(mode: AgentMode, policy: AgentPolicy, delegation: Delegation): TurnControls {
  if (mode === "ask") return { policy: "read-only", delegation: "none" };
  return { policy, delegation };
}

// modelRef is set only when the user intentionally chose a model. Absent, Core keeps the session's
// pinned model, or picks Effective.Model for a session that has none. delegation is the thread's grant
// as the user set it; Core validates and enforces it for this Start only. effort is sent only when the
// displayed model supports it (supportedEffort); Core validates Effort against the model.
export function buildAgentConfig(
  modelRef: string | undefined,
  policy: AgentPolicy,
  maxSteps: number,
  delegation: Delegation = "none",
  mode: AgentMode = "agent",
  effort?: AgentEffort,
): AgentConfig {
  const turn = resolveTurnOptions(mode, policy, delegation);
  return {
    modelRef,
    effort,
    policy: turn.policy,
    maxSteps,
    maxToolCallsPerStep: 8,
    delegation: turn.delegation,
    mode,
  };
}

// A follow-up turn carries the attached context paths in the message text (Core's continue input is
// plain text; session context paths exist only at creation). The chips show the user exactly what
// will be appended.
export function composeFollowUpInput(task: string, contextPaths: string[], contextLabel: string): string {
  const paths = contextPaths.filter((path) => path.trim());
  if (!paths.length) return task;
  return `${task}\n\n${contextLabel}:\n${paths.map((path) => `- ${path}`).join("\n")}`;
}
