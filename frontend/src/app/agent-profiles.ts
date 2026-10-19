import type { AgentProfile } from "../types";
import type { AppCopy } from "../lib/i18n/app-copy";

// The Desktop agent profile catalog, frontend side: the two built-ins, the id resolution the
// composer and the page share, and the bounds the page enforces while typing. The backend owns
// the file and validates again; these values mirror it so the UI can explain a refusal early.
export const AGENT_PROFILE_LIMITS = {
  total: 16,
  name: 40,
  description: 280,
  instructions: 8000,
} as const;

export const BUILTIN_AGENT_IDS = ["ask", "agent"] as const;

/** The agent selector's data: the catalog, the remembered id and the pick handler. */
export type ComposerAgent = {
  profiles: AgentProfile[];
  selectedId: string;
  onSelect: (id: string) => void;
};

/** The built-ins a fresh catalog starts with; the backend returns the same two first. */
export function builtinAgentProfiles(): AgentProfile[] {
  return [
    { id: "ask", name: "Ask", base: "ask", instructions: "", policy: "read-only", builtin: true },
    { id: "agent", name: "Agent", base: "agent", instructions: "", policy: "workspace", builtin: true },
  ];
}

/**
 * A stored selection that no longer exists (deleted profile, old catalog) falls back to the Agent
 * built-in, which is the pre-profile behavior and the widest base the user explicitly chose.
 */
export function resolveAgentId(profiles: AgentProfile[], id: string | undefined): string {
  return id && profiles.some((profile) => profile.id === id) ? id : "agent";
}

/** Built-in names are localized by id; a custom profile keeps the name the user gave it. */
export function agentProfileName(profile: AgentProfile, labels: AppCopy): string {
  if (profile.id === "ask") return labels.agentAskName;
  if (profile.id === "agent") return labels.agentAgentName;
  return profile.name;
}

/** One unique "<name> copy" within the bound, used by Duplicate. */
export function duplicateAgentName(profile: AgentProfile, profiles: AgentProfile[], labels: AppCopy): string {
  const suffix = ` ${labels.agentCopySuffix}`;
  const base = agentProfileName(profile, labels).slice(0, Math.max(1, AGENT_PROFILE_LIMITS.name - suffix.length));
  const taken = new Set(profiles.map((item) => item.name.toLowerCase()));
  let candidate = `${base}${suffix}`;
  for (let i = 2; taken.has(candidate.toLowerCase()); i += 1) {
    const numbered = ` (${i})`;
    candidate = `${base.slice(0, Math.max(1, AGENT_PROFILE_LIMITS.name - suffix.length - numbered.length))}${suffix}${numbered}`;
  }
  return candidate;
}

/** Whether a save would pass the page's own validation; the backend checks the same bounds. */
export function validateAgentDraft(profile: AgentProfile, profiles: AgentProfile[], labels: AppCopy): string {
  const name = profile.name.trim();
  if (!name) return labels.agentNameRequired;
  if (Array.from(name).length > AGENT_PROFILE_LIMITS.name) return labels.agentNameTooLong;
  if (Array.from(profile.instructions).length > AGENT_PROFILE_LIMITS.instructions) return labels.agentInstructionsTooLong;
  if (profiles.some((item) => item.id !== profile.id && item.name.toLowerCase() === name.toLowerCase())) {
    return labels.agentNameTaken;
  }
  if (!profile.id && profiles.length >= AGENT_PROFILE_LIMITS.total) return labels.agentLimitReached;
  return "";
}
