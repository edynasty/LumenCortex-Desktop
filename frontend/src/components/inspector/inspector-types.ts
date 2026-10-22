import type { AppCopy } from "../../lib/i18n/app-copy";

export type InspectorPolicy = "read-only" | "workspace" | "full";

// The panes the inspector shows (Demo "Lumen Glass" thread panel): Task · Window · Checks · Run.
// The runtime event list and the debug shell are sections of Run.
export type InspectorTab = "task" | "window" | "checks" | "run";

// Every string the inspector chrome and its panes show; copy itself lives in app-copy.ts.
export type InspectorLabels = Omit<
  Pick<
    AppCopy,
  | "inspector"
  | "task"
  | "windowTab"
  | "checks"
  | "run"
  | "close"
  | "provider"
  | "modelSelect"
  | "modelSearch"
  | "noModelMatches"
  | "noModels"
  | "providerConfig"
  | "runSettingsNote"
  | "policy"
  | "readOnly"
  | "readOnlyDescription"
  | "workspace"
  | "workspaceDescription"
  | "full"
  | "fullDescription"
  | "maxSteps"
  | "runtime"
  | "workingMemory"
  | "softBudget"
  | "hardBudget"
  | "maxAgents"
  | "inspectorCheckpoints"
  | "inspectorNoCheckpoints"
  | "shellCommand"
  | "runCommand"
  | "shellHint"
  | "terminal"
  | "activity"
  | "noActivity"
  | "subagents"
  | "noSubagents"
  | "subagentActive"
  | "subagentCompleted"
  | "subagentInterrupted"
  | "subagentImported"
  | "lsp"
  | "lspCommand"
  | "lspArgs"
  | "lspLanguage"
  | "lspStart"
  | "lspStop"
  | "lspRunning"
  | "lspStopped"
  | "lspPid"
  | "lspPending"
  | "lspDiagnostics"
  | "lspDiagnosticPath"
  | "lspDiagnosticRefresh"
  | "lspNoDiagnostics"
  | "lspSeverityError"
  | "lspSeverityWarning"
  | "lspSeverityInfo"
  | "lspSeverityHint"
  | "lspLastError"
  | "milestoneAgentStarted"
  | "milestoneAgentStopped"
  | "milestoneToolCompleted"
  | "milestoneApprovalRequired"
  | "milestoneApprovalGranted"
  | "milestoneSubagentStarted"
  | "milestoneSubagentStopped"
  | "milestoneWorktreeCreated"
  | "milestoneWorktreeApplied"
  | "milestoneTaskCompleted"
  | "milestoneTaskInterrupted"
  | "milestoneWorkflowAdvanced"
  >,
  "noModels"
> & {
  // The model picker placeholder is computed at runtime (no model configured, or a pinned model
  // that is unavailable), so it is a plain string rather than a copy key.
  noModels: string;
};
