import type { AgentEffort } from "../types";
import type { AgentMode, AgentPolicy } from "./agent-config";

// What the user last chose in the composer, so reopening the app does not fall back to defaults.
// UI preference only (refs and enums, never keys). The execution target (Local/Worktree) is
// deliberately absent: it belongs to one new session and starts at Local every time.
export type ComposerPreferences = {
  policy: AgentPolicy;
  mode: AgentMode;
  effort?: AgentEffort;
  modelRef?: string;
};

const KEY = "lcx-composer";
const POLICIES: AgentPolicy[] = ["read-only", "workspace", "full"];
const MODES: AgentMode[] = ["ask", "agent"];
const EFFORTS: AgentEffort[] = ["none", "low", "medium", "high", "max"];

export const defaultComposerPreferences: ComposerPreferences = { policy: "workspace", mode: "agent" };

export function readComposerPreferences(): ComposerPreferences {
  let stored: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (parsed && typeof parsed === "object") stored = parsed as Record<string, unknown>;
  } catch {
    stored = {};
  }
  const policy = POLICIES.find((item) => item === stored.policy) ?? defaultComposerPreferences.policy;
  const mode = MODES.find((item) => item === stored.mode) ?? defaultComposerPreferences.mode;
  const effort = EFFORTS.find((item) => item === stored.effort);
  const modelRef = typeof stored.modelRef === "string" && stored.modelRef ? stored.modelRef : undefined;
  return { policy, mode, effort, modelRef };
}

// Merges one change into the stored preferences; an undefined value clears that key.
export function saveComposerPreferences(patch: Partial<ComposerPreferences>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readComposerPreferences(), ...patch }));
  } catch {
    // Storage may be unavailable; remembering the choice is a nicety, never an error.
  }
}
