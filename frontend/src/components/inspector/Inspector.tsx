import type { ChangeEvent, FormEvent } from "react";
import { SquareTerminal, X } from "lucide-react";
import type { Health, LSPDiagnostic, LSPStatus, RuntimeEvent, SessionCheckpoint, SubagentNode } from "../../types";
import type { SelectOption } from "../primitives/Select";
import { MilestoneList } from "./MilestoneList";
import { RunSettingsPanel } from "./RunSettingsPanel";

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
  labels: {
    activity: string;
    run: string;
    terminal: string;
    close: string;
    noActivity: string;
    provider: string;
    modelSelect: string;
    modelSearch: string;
    noModelMatches: string;
    noModels: string;
    providerConfig: string;
    envFallback: string;
    policy: string;
    readOnly: string;
    workspace: string;
    full: string;
    maxSteps: string;
    runtime: string;
    workingMemory: string;
    softBudget: string;
    hardBudget: string;
    maxAgents: string;
    shellCommand: string;
    runCommand: string;
    shellHint: string;
    lsp: string;
    lspCommand: string;
    lspArgs: string;
    lspLanguage: string;
    lspStart: string;
    lspStop: string;
    lspRunning: string;
    lspStopped: string;
    lspPid: string;
    lspPending: string;
    lspDiagnostics: string;
    lspDiagnosticPath: string;
    lspDiagnosticRefresh: string;
    lspNoDiagnostics: string;
    lspSeverityError: string;
    lspSeverityWarning: string;
    lspSeverityInfo: string;
    lspSeverityHint: string;
    lspLastError: string;
    subagents: string;
    noSubagents: string;
    subagentActive: string;
    subagentCompleted: string;
    subagentInterrupted: string;
    subagentCheckpoint: string;
    milestoneAgentStarted: string;
    milestoneAgentStopped: string;
    milestoneToolCompleted: string;
    milestoneApprovalRequired: string;
    milestoneApprovalGranted: string;
    milestoneSubagentStarted: string;
    milestoneSubagentStopped: string;
    milestoneWorktreeCreated: string;
    milestoneWorktreeApplied: string;
    milestoneTaskCompleted: string;
    milestoneTaskInterrupted: string;
    milestoneWorkflowAdvanced: string;
  };
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

export function Inspector({
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
    <aside className="inspector">
      <div className="inspector-head">
        <div className="inspector-tabs">
          <button className={tab === "activity" ? "active" : ""} onClick={() => onTabChange("activity")}>{labels.activity}</button>
          <button className={tab === "run" ? "active" : ""} onClick={() => onTabChange("run")}>{labels.run}</button>
          <button className={tab === "terminal" ? "active" : ""} onClick={() => onTabChange("terminal")}>{labels.terminal}</button>
        </div>
        <button className="icon-button inspector-close" onClick={onClose} aria-label={labels.close}>
          <X size={14} strokeWidth={1.7} aria-hidden />
        </button>
      </div>

      <div className="inspector-body">
        {tab === "activity" && (
          <MilestoneList
            events={events}
            labels={{
              empty: labels.noActivity,
              agentStarted: labels.milestoneAgentStarted,
              agentStopped: labels.milestoneAgentStopped,
              toolCompleted: labels.milestoneToolCompleted,
              approvalRequired: labels.milestoneApprovalRequired,
              approvalGranted: labels.milestoneApprovalGranted,
              subagentStarted: labels.milestoneSubagentStarted,
              subagentStopped: labels.milestoneSubagentStopped,
              worktreeCreated: labels.milestoneWorktreeCreated,
              worktreeApplied: labels.milestoneWorktreeApplied,
              taskCompleted: labels.milestoneTaskCompleted,
              taskInterrupted: labels.milestoneTaskInterrupted,
              workflowAdvanced: labels.milestoneWorkflowAdvanced,
            }}
          />
        )}

        {tab === "run" && (
          <RunSettingsPanel
            modelRef={modelRef}
            models={models}
            policy={policy}
            maxSteps={maxSteps}
            health={health}
            pressure={pressure}
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
            busy={busy}
            labels={labels}
            onModelChange={onModelChange}
            onOpenProviders={onOpenProviders}
            onPolicyChange={onPolicyChange}
            onMaxStepsChange={onMaxStepsChange}
            onLSPCommandChange={onLSPCommandChange}
            onLSPArgsChange={onLSPArgsChange}
            onLSPLanguageChange={onLSPLanguageChange}
            onLSPDiagnosticPathChange={onLSPDiagnosticPathChange}
            onRefreshLSPDiagnostics={onRefreshLSPDiagnostics}
            onStartLSP={onStartLSP}
            onStopLSP={onStopLSP}
            onOpenSubagent={onOpenSubagent}
          />
        )}

        {tab === "terminal" && (
          <form className="terminal-pane" onSubmit={onRunShell}>
            <div className="terminal-title">
              <SquareTerminal size={15} strokeWidth={1.7} aria-hidden />
              {labels.shellCommand}
            </div>
            <textarea
              value={command}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onCommandChange(event.target.value)}
              rows={7}
              disabled={!selectedSessionId || running}
            />
            <button
              className="secondary-action"
              disabled={busy || !selectedSessionId || running || !command.trim()}
            >
              {labels.runCommand}
            </button>
            <p>{labels.shellHint}</p>
          </form>
        )}
      </div>
    </aside>
  );
}
