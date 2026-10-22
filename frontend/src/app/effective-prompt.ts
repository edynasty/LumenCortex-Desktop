import type { AppCopy } from "../lib/i18n/app-copy";
import type { PromptTool } from "../types";

// Core's vocabulary, rendered in the app language. Every map falls back to Core's own string, so a
// value this build does not know is still shown instead of disappearing.

// Only the keys this module reads: some AppCopy entries are functions, and a lookup must stay a
// string.
const KIND = {
  builtin: "promptKindBuiltin",
  "global-instructions": "promptKindGlobalInstructions",
  "project-instructions": "promptKindProjectInstructions",
  skills: "promptKindSkills",
  "agent-instructions": "promptKindAgentInstructions",
  "task-state": "promptKindTaskState",
} as const;
type KindKey = (typeof KIND)[keyof typeof KIND];

const SCOPE = {
  core: "promptScopeCore",
  global: "promptScopeGlobal",
  project: "promptScopeProject",
  agent: "promptScopeAgent",
  session: "promptScopeSession",
} as const;
type ScopeKey = (typeof SCOPE)[keyof typeof SCOPE];

// Layer reasons are Core's stable strings (instructions.ReasonMissing, skillsLayer, agentLayer),
// and tool reasons are Core's filters.
const REASON = {
  missing: "promptReasonMissing",
  "untrusted workspace": "promptReasonUntrusted",
  "resolves outside the workspace": "promptReasonOutsideWorkspace",
  "not a regular file": "promptReasonNotRegular",
  unreadable: "promptReasonUnreadable",
  "no enabled skills": "promptReasonNoSkills",
  "no skill registry": "promptReasonNoRegistry",
  none: "promptReasonNoAgentInstructions",
  policy: "promptReasonPolicy",
  allowlist: "promptReasonAllowlist",
  denylist: "promptReasonDenylist",
  delegation: "promptReasonDelegation",
} as const;
type ReasonKey = (typeof REASON)[keyof typeof REASON];

export function layerKindLabel(kind: string, labels: AppCopy): string {
  const key = (KIND as Record<string, KindKey | undefined>)[kind];
  return key ? labels[key] : labels.promptKindOther;
}

export function layerScopeLabel(scope: string | undefined, labels: AppCopy): string {
  if (!scope) return "";
  const key = (SCOPE as Record<string, ScopeKey | undefined>)[scope];
  return key ? labels[key] : scope;
}

/** Why a layer is not loaded, or which filter withholds a tool. */
export function reasonLabel(reason: string | undefined, labels: AppCopy): string {
  if (!reason) return "";
  const key = (REASON as Record<string, ReasonKey | undefined>)[reason];
  return key ? labels[key] : reason;
}

/** The grant Core actually decided, which may be narrower than the one the page asked for. */
export function policyLabel(policy: string, labels: AppCopy): string {
  switch (policy) {
    case "read-only":
      return labels.readOnly;
    case "workspace":
      return labels.workspace;
    case "full":
      return labels.full;
    default:
      return policy;
  }
}

export type ToolGroup = { source: string; label: string; tools: PromptTool[] };

/** The source's heading: builtin/task/lsp/delegation, or an MCP server by id. */
export function toolSourceLabel(source: string, labels: AppCopy): string {
  if (source.startsWith("mcp:")) {
    return `${labels.promptSourceMcp} · ${source.slice("mcp:".length)}`;
  }
  switch (source) {
    case "builtin":
      return labels.promptSourceBuiltin;
    case "task":
      return labels.promptSourceTask;
    case "lsp":
      return labels.promptSourceLsp;
    case "delegation":
      return labels.promptSourceDelegation;
    default:
      return source;
  }
}

/**
 * Tools grouped by where they come from, in the order Core lists them, so a run's MCP servers and
 * its built-ins are never mixed into one flat list.
 */
export function groupTools(tools: PromptTool[], labels: AppCopy): ToolGroup[] {
  const groups: ToolGroup[] = [];
  const bySource = new Map<string, ToolGroup>();
  for (const tool of tools) {
    let group = bySource.get(tool.source);
    if (!group) {
      group = { source: tool.source, label: toolSourceLabel(tool.source, labels), tools: [] };
      bySource.set(tool.source, group);
      groups.push(group);
    }
    group.tools.push(tool);
  }
  return groups;
}
