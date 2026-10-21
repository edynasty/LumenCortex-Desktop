import type { AgentEntry, AgentLimits, AgentPolicy, AgentUse, AgentDelegation } from "../types";
import type { AppCopy } from "../lib/i18n/app-copy";

// Core's agent catalog, frontend side: the built-in fallback the composer starts from, the id
// resolution the composer and the page share, and the bounds the page checks while typing. Core
// owns the file and validates again; these values mirror its limits so a refusal is explained early.

/** Core's catalog bounds (config.MaxCustomAgents and friends). */
export const AGENT_LIMITS: AgentLimits = {
  maxCustom: 16,
  name: 40,
  description: 280,
  instructions: 16 << 10,
  models: 8,
  idPattern: "^[a-z][a-z0-9-]{0,39}$",
};

export const BUILTIN_AGENT_IDS = ["ask", "agent", "explore", "worker"] as const;

/** The agent selector's data: the conversation agents, the selection and the pick handler. */
export type ComposerAgent = {
  agents: AgentEntry[];
  selectedId: string;
  /** The selection is Core's, not the user's: a child thread's pinned agent cannot be changed. */
  locked?: boolean;
  onSelect: (id: string) => void;
};

/**
 * The four built-ins as Core defines them, without instructions: the composer must work before the
 * catalog arrives (or when the bridge is unavailable). Core answers with the same entries first.
 */
export function builtinAgents(): AgentEntry[] {
  const entry = (
    id: string, name: string, use: AgentUse, policy: AgentPolicy, delegation: AgentDelegation, forConversation: boolean,
  ): AgentEntry => ({
    id, name, description: "", use, policy, delegation, instructions: "",
    models: null, builtin: true, source: "builtin", digest: "", forConversation, editable: true,
  });
  return [
    entry("ask", "Ask", "conversation", "read-only", "none", true),
    entry("agent", "Agent", "conversation", "full", "isolated", true),
    entry("explore", "Explore", "delegation", "read-only", "none", false),
    entry("worker", "Worker", "delegation", "workspace", "none", false),
  ];
}

export const POLICY_ORDER: readonly AgentPolicy[] = ["read-only", "workspace", "full"];
export const DELEGATION_ORDER: readonly AgentDelegation[] = ["none", "propose", "isolated"];

/**
 * What a grant becomes under an agent's ceiling (ADR-0009: Core runs min(grant, ceiling)): the values
 * the user may still pick, lowest first, and the one Core will run with. The stored grant itself is
 * left alone, so switching to an agent with a higher ceiling restores it.
 */
export function underCeiling<T extends string>(order: readonly T[], grant: T, ceiling: T): { allowed: T[]; effective: T } {
  const limit = order.indexOf(ceiling);
  const allowed = limit < 0 ? [...order] : order.slice(0, limit + 1);
  return { allowed, effective: allowed.includes(grant) ? grant : allowed[allowed.length - 1] };
}

/** The agents a composer may run: everything but delegation-only ones (ADR-0009). */
export function conversationAgents(agents: AgentEntry[]): AgentEntry[] {
  return agents.filter((agent) => agent.forConversation);
}

/**
 * A stored or pinned selection that no longer exists, or that cannot run a conversation, falls back
 * to the Agent built-in: the default Core pins when a session names no agent.
 */
export function resolveAgentId(agents: AgentEntry[], id: string | undefined): string {
  return id && agents.some((agent) => agent.id === id && agent.forConversation) ? id : "agent";
}

/** Built-in names are localized by id; a custom agent keeps the name the user gave it. */
export function agentName(agent: AgentEntry, labels: AppCopy): string {
  switch (agent.id) {
    case "ask": return labels.agentAskName;
    case "agent": return labels.agentAgentName;
    case "explore": return labels.agentExploreName;
    case "worker": return labels.agentWorkerName;
    default: return agent.name;
  }
}

/** A short line for the picker: a built-in's own explanation, else the agent's description. */
export function agentDescription(agent: AgentEntry, labels: AppCopy): string | undefined {
  if (!agent.builtin) return agent.description || undefined;
  if (!agent.forConversation) return labels.agentsUseDelegationDescription;
  return agent.policy === "read-only" ? labels.readOnlyDescription : labels.workspaceDescription;
}

/** UTF-8 size, which is what Core's instruction bound counts. */
export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** One unique "<name> copy" within the name bound, used by Duplicate. */
export function copyAgentName(agent: AgentEntry, agents: AgentEntry[], labels: AppCopy): string {
  const suffix = ` ${labels.agentCopySuffix}`;
  const base = agentName(agent, labels).slice(0, Math.max(1, AGENT_LIMITS.name - suffix.length));
  const taken = new Set(agents.map((item) => item.name.toLowerCase()));
  let candidate = `${base}${suffix}`;
  for (let i = 2; taken.has(candidate.toLowerCase()); i += 1) {
    const numbered = ` (${i})`;
    candidate = `${base.slice(0, Math.max(1, AGENT_LIMITS.name - suffix.length - numbered.length))}${suffix}${numbered}`;
  }
  return candidate;
}

/**
 * Whether a save would pass the page's own validation; Core checks the same bounds and refuses the
 * rest (a delegation agent without a ceiling, a model outside the catalog, a duplicate name).
 */
export function validateAgentDraft(draft: AgentEntry, agents: AgentEntry[], labels: AppCopy): string {
  if (draft.builtin) {
    return utf8Bytes(draft.instructions) > AGENT_LIMITS.instructions ? labels.agentInstructionsTooLong : "";
  }
  const name = draft.name.trim();
  if (!name) return labels.agentNameRequired;
  if (Array.from(name).length > AGENT_LIMITS.name) return labels.agentNameTooLong;
  if (utf8Bytes(draft.instructions) > AGENT_LIMITS.instructions) return labels.agentInstructionsTooLong;
  if (utf8Bytes(draft.description ?? "") > AGENT_LIMITS.description) return labels.agentDescriptionTooLong;
  // Core treats every non-conversation use as delegation: it never delegates further (the backend
  // clears that field), caps its policy at read-only or workspace, and needs a description the
  // model selects it by.
  if (draft.use !== "conversation") {
    if (draft.policy === "full") return labels.agentDelegationPolicy;
    if (!draft.description?.trim()) return labels.agentDelegationNeedsDescription;
  }
  if ((draft.models?.length ?? 0) > AGENT_LIMITS.models) return labels.agentsModelsLimit;
  if (agents.some((item) => item.id !== draft.id && item.name.toLowerCase() === name.toLowerCase())) {
    return labels.agentNameTaken;
  }
  if (!draft.id && agents.filter((item) => !item.builtin).length >= AGENT_LIMITS.maxCustom) {
    return labels.agentLimitReached;
  }
  return "";
}

/** An unsaved custom agent: conversation-scoped, no ceilings, inheriting the default model list. */
export function emptyAgent(): AgentEntry {
  return {
    id: "",
    name: "",
    description: "",
    use: "conversation",
    policy: "full",
    delegation: "isolated",
    instructions: "",
    models: null,
    builtin: false,
    source: "global",
    digest: "",
    forConversation: true,
    editable: true,
  };
}

/** Two drafts are the same when every editable field matches; `digest` and `source` are not edited. */
export function sameAgentDraft(a: AgentEntry, b: AgentEntry): boolean {
  return a.id === b.id && a.name === b.name && (a.description ?? "") === (b.description ?? "")
    && a.use === b.use && a.policy === b.policy && a.delegation === b.delegation
    && a.instructions === b.instructions && (a.effort ?? "") === (b.effort ?? "")
    && sameModels(a.models, b.models);
}

export function sameModels(a: AgentEntry["models"], b: AgentEntry["models"]): boolean {
  const left = a ?? [];
  const right = b ?? [];
  return left.length === right.length
    && left.every((item, index) => item.model === right[index].model && (item.effort ?? "") === (right[index].effort ?? ""));
}
