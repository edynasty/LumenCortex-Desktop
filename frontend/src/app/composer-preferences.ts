import type { AgentEffort, AgentPolicy } from "../types";

// What the user last chose in the composer, so reopening the app does not fall back to defaults.
// UI preference only (refs and enums, never keys). The execution target (Local/Worktree) is
// deliberately absent: it belongs to one new session and starts at Local every time.
export type ComposerPreferences = {
  policy: AgentPolicy;
  // The selected catalog agent id. A deleted, unknown or delegation-only id falls back to "agent"
  // (see resolveAgentId); an open thread shows its pinned agent instead.
  agentId: string;
  effort?: AgentEffort;
  modelRef?: string;
};

const KEY = "lcx-composer";
const POLICIES: AgentPolicy[] = ["read-only", "workspace", "full"];
const EFFORTS: AgentEffort[] = ["none", "low", "medium", "high", "max", "auto"];

export const defaultComposerPreferences: ComposerPreferences = { policy: "workspace", agentId: "agent" };

export function readComposerPreferences(): ComposerPreferences {
  let stored: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (parsed && typeof parsed === "object") stored = parsed as Record<string, unknown>;
  } catch {
    stored = {};
  }
  const policy = POLICIES.find((item) => item === stored.policy) ?? defaultComposerPreferences.policy;
  const effort = EFFORTS.find((item) => item === stored.effort);
  const modelRef = typeof stored.modelRef === "string" && stored.modelRef ? stored.modelRef : undefined;
  const agentId = typeof stored.agentId === "string" && stored.agentId ? stored.agentId : defaultComposerPreferences.agentId;
  return { policy, agentId, effort, modelRef };
}

// Merges one change into the stored preferences; an undefined value clears that key.
export function saveComposerPreferences(patch: Partial<ComposerPreferences>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readComposerPreferences(), ...patch }));
  } catch {
    // Storage may be unavailable; remembering the choice is a nicety, never an error.
  }
}
