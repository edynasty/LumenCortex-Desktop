import type { AppCopy } from "./i18n/app-copy";
import { coreErrorKey, type CoreErrorKey } from "./core-errors";

type ErrorLabels = Pick<
  AppCopy,
  | "runningElsewhereError"
  | "errWorktreeBusy"
  | "errDatabaseInUse"
  | "errSchemaTooNew"
  | "errLegacyNodeDatabase"
  | "errUnknownModel"
  | "errModelWithoutToolCalling"
  | "errInvalidEffort"
  | "errConflict"
  | "errInvalidConfig"
  | "errSubagentModelRetired"
  | "errUnknownAgent"
  | "errAgentNotForConversation"
  | "errAgentUseMismatch"
  | "errNoFingerprint"
  | "errUnknownCheck"
  | "errTaskProposalNotFound"
  | "errTaskProposalStarted"
  | "errTaskNeedsCommit"
  | "errChildLimit"
  | "errAgentLimit"
>;

const labelKey: Record<CoreErrorKey, keyof ErrorLabels> = {
  databaseInUse: "errDatabaseInUse",
  schemaTooNew: "errSchemaTooNew",
  legacyNodeDatabase: "errLegacyNodeDatabase",
  unknownModel: "errUnknownModel",
  modelWithoutToolCalls: "errModelWithoutToolCalling",
  invalidEffort: "errInvalidEffort",
  conflict: "errConflict",
  invalidConfig: "errInvalidConfig",
  subagentModelRetired: "errSubagentModelRetired",
  unknownAgent: "errUnknownAgent",
  agentNotForConversation: "errAgentNotForConversation",
  agentUseMismatch: "errAgentUseMismatch",
  runHeld: "runningElsewhereError",
  worktreeBusy: "errWorktreeBusy",
  noFingerprint: "errNoFingerprint",
  unknownCheck: "errUnknownCheck",
  taskProposalNotFound: "errTaskProposalNotFound",
  taskProposalStarted: "errTaskProposalStarted",
  taskNeedsCommit: "errTaskNeedsCommit",
  childLimit: "errChildLimit",
  agentLimit: "errAgentLimit",
};

// A Core error the UI knows is shown as actionable localized copy. Any other error keeps its text.
// An invalid configuration keeps Core's detail, because it names the entry to fix.
export function presentError(labels: ErrorLabels, error: string): string {
  const key = coreErrorKey(error);
  if (!key) return error;
  const text = labels[labelKey[key]];
  if (key !== "invalidConfig") return text;
  const detail = error.replace(/^Error:\s*/, "").replace(/^invalid configuration:\s*/, "");
  return text + detail;
}
