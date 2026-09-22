import type { FormEvent } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type {
  Health,
  LSPDiagnostic,
  LSPStatus,
  RuntimeEvent,
  SessionCheckpoint,
  SubagentNode,
} from "../../types";
import type { SelectOption } from "../primitives/Select";
import { Inspector } from "./Inspector";
import type { InspectorPolicy, InspectorTab } from "./inspector-types";

type Props = {
  tab: InspectorTab;
  events: RuntimeEvent[];
  modelRef: string;
  models: SelectOption[];
  policy: InspectorPolicy;
  maxSteps: number;
  health?: Health;
  pressure: number;
  command: string;
  lspCommand: string;
  lspArgs: string;
  lspLanguage: string;
  lspStatus: LSPStatus;
  lspDiagnosticPath: string;
  lspDiagnostics: LSPDiagnostic[];
  subagents: SubagentNode[];
  checkpoints: SessionCheckpoint[];
  workspaceOpen: boolean;
  selectedSessionId: string;
  running: boolean;
  busy: boolean;
  labels: AppCopy;
  onTabChange: (tab: InspectorTab) => void;
  onClose: () => void;
  onModelChange: (value: string) => void;
  onOpenProviders: () => void;
  onPolicyChange: (value: InspectorPolicy) => void;
  onMaxStepsChange: (value: number) => void;
  onCommandChange: (value: string) => void;
  onLSPCommandChange: (value: string) => void;
  onLSPArgsChange: (value: string) => void;
  onLSPLanguageChange: (value: string) => void;
  onLSPDiagnosticPathChange: (value: string) => void;
  onRefreshLSPDiagnostics: () => void;
  onStartLSP: () => void;
  onStopLSP: () => void;
  onOpenSubagent: (sessionId: string) => void;
  onRunShell: (event: FormEvent<HTMLFormElement>) => void;
};

export function WorkspaceInspector({
  tab,
  events,
  modelRef,
  models,
  policy,
  maxSteps,
  health,
  pressure,
  command,
  lspCommand,
  lspArgs,
  lspLanguage,
  lspStatus,
  lspDiagnosticPath,
  lspDiagnostics,
  subagents,
  checkpoints,
  workspaceOpen,
  selectedSessionId,
  running,
  busy,
  labels,
  onTabChange,
  onClose,
  onModelChange,
  onOpenProviders,
  onPolicyChange,
  onMaxStepsChange,
  onCommandChange,
  onLSPCommandChange,
  onLSPArgsChange,
  onLSPLanguageChange,
  onLSPDiagnosticPathChange,
  onRefreshLSPDiagnostics,
  onStartLSP,
  onStopLSP,
  onOpenSubagent,
  onRunShell,
}: Props) {
  return (
    <Inspector
      tab={tab}
      events={events}
      modelRef={modelRef}
      models={models}
      policy={policy}
      maxSteps={maxSteps}
      health={health}
      pressure={pressure}
      command={command}
      lspCommand={lspCommand}
      lspArgs={lspArgs}
      lspLanguage={lspLanguage}
      lspStatus={lspStatus}
      lspDiagnosticPath={lspDiagnosticPath}
      lspDiagnostics={lspDiagnostics}
      subagents={subagents}
      checkpoints={checkpoints}
      workspaceOpen={workspaceOpen}
      selectedSessionId={selectedSessionId}
      running={running}
      busy={busy}
      labels={{
        activity: labels.activity,
        run: labels.run,
        terminal: labels.terminal,
        close: labels.close,
        noActivity: labels.noActivity,
        provider: labels.provider,
        modelSelect: labels.modelSelect,
        noModels: labels.noModels,
        providerConfig: labels.providerConfig,
        envFallback: labels.envFallback,
        policy: labels.policy,
        readOnly: labels.readOnly,
        workspace: labels.workspace,
        full: labels.full,
        maxSteps: labels.maxSteps,
        runtime: labels.runtime,
        workingMemory: labels.workingMemory,
        softBudget: labels.softBudget,
        hardBudget: labels.hardBudget,
        maxAgents: labels.maxAgents,
        shellCommand: labels.shellCommand,
        runCommand: labels.runCommand,
        shellHint: labels.shellHint,
        lsp: labels.lsp,
        lspCommand: labels.lspCommand,
        lspArgs: labels.lspArgs,
        lspLanguage: labels.lspLanguage,
        lspStart: labels.lspStart,
        lspStop: labels.lspStop,
        lspRunning: labels.lspRunning,
        lspStopped: labels.lspStopped,
        lspPid: labels.lspPid,
        lspPending: labels.lspPending,
        lspDiagnostics: labels.lspDiagnostics,
        lspDiagnosticPath: labels.lspDiagnosticPath,
        lspDiagnosticRefresh: labels.lspDiagnosticRefresh,
        lspNoDiagnostics: labels.lspNoDiagnostics,
        lspSeverityError: labels.lspSeverityError,
        lspSeverityWarning: labels.lspSeverityWarning,
        lspSeverityInfo: labels.lspSeverityInfo,
        lspSeverityHint: labels.lspSeverityHint,
        lspLastError: labels.lspLastError,
        milestoneAgentStarted: labels.milestoneAgentStarted,
        milestoneAgentStopped: labels.milestoneAgentStopped,
        milestoneToolCompleted: labels.milestoneToolCompleted,
        milestoneApprovalRequired: labels.milestoneApprovalRequired,
        milestoneApprovalGranted: labels.milestoneApprovalGranted,
        milestoneSubagentStarted: labels.milestoneSubagentStarted,
        milestoneSubagentStopped: labels.milestoneSubagentStopped,
        milestoneWorktreeCreated: labels.milestoneWorktreeCreated,
        milestoneWorktreeApplied: labels.milestoneWorktreeApplied,
        milestoneTaskCompleted: labels.milestoneTaskCompleted,
        milestoneTaskInterrupted: labels.milestoneTaskInterrupted,
        milestoneWorkflowAdvanced: labels.milestoneWorkflowAdvanced,
        subagents: labels.subagents,
        noSubagents: labels.noSubagents,
        subagentActive: labels.subagentActive,
        subagentCompleted: labels.subagentCompleted,
        subagentInterrupted: labels.subagentInterrupted,
        subagentCheckpoint: labels.subagentCheckpoint,
      }}
      onTabChange={onTabChange}
      onClose={onClose}
      onModelChange={onModelChange}
      onOpenProviders={onOpenProviders}
      onPolicyChange={onPolicyChange}
      onMaxStepsChange={onMaxStepsChange}
      onCommandChange={onCommandChange}
      onLSPCommandChange={onLSPCommandChange}
      onLSPArgsChange={onLSPArgsChange}
      onLSPLanguageChange={onLSPLanguageChange}
      onLSPDiagnosticPathChange={onLSPDiagnosticPathChange}
      onRefreshLSPDiagnostics={onRefreshLSPDiagnostics}
      onStartLSP={onStartLSP}
      onStopLSP={onStopLSP}
      onOpenSubagent={onOpenSubagent}
      onRunShell={onRunShell}
    />
  );
}
