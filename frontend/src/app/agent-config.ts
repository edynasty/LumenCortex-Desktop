import type { AgentConfig, AgentEffort, AgentPolicy, Delegation } from "../types";

// modelRef is set only when the user intentionally chose a model. Absent, Core keeps the session's
// pinned model, or the agent's first model when the agent changed in the same Start. delegation is
// the thread's grant as the user set it; Core validates it, enforces it and caps it by the agent's
// ceiling (ADR-0009), so nothing here narrows authority on its own. effort is sent only when the
// displayed model supports it (supportedEffort); Core validates Effort against the model.
export function buildAgentConfig(
  modelRef: string | undefined,
  policy: AgentPolicy,
  maxSteps: number,
  delegation: Delegation = "none",
  agent?: string,
  effort?: AgentEffort,
): AgentConfig {
  return {
    modelRef,
    effort,
    policy,
    maxSteps,
    maxToolCallsPerStep: 8,
    delegation,
    agent,
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
