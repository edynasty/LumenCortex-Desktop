import type { ChangeEvent, FormEvent } from "react";
import type { LSPDiagnostic, LSPStatus, RuntimeEvent, SubagentNode } from "../../types";
import { DesktopSelect, type SelectOption } from "../primitives/Select";
import { LSPSettingsPanel } from "./LSPSettingsPanel";
import { MilestoneList } from "./MilestoneList";
import { SubagentTreePanel } from "./SubagentTreePanel";
import { InspectorSection } from "./Section";
import type { InspectorLabels, InspectorPolicy } from "./inspector-types";

export type RunSettingsLabels = Pick<
  InspectorLabels,
  | "provider"
  | "modelSelect"
  | "modelSearch"
  | "noModelMatches"
  | "noModels"
  | "providerConfig"
  | "runSettingsNote"
  | "run"
  | "policy"
  | "readOnly"
  | "readOnlyDescription"
  | "workspace"
  | "workspaceDescription"
  | "full"
  | "fullDescription"
  | "maxSteps"
  | "subagents"
  | "noSubagents"
  | "subagentActive"
  | "subagentCompleted"
  | "subagentInterrupted"
  | "subagentImported"
  | "terminal"
  | "shellCommand"
  | "runCommand"
  | "shellHint"
  | "activity"
  | "noActivity"
  | "milestoneAgentStarted"
  | "milestoneAgentStopped"
  | "milestoneToolCompleted"
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
  | "milestoneApprovalRequired"
  | "milestoneApprovalGranted"
  | "milestoneSubagentStarted"
  | "milestoneSubagentStopped"
  | "milestoneWorktreeCreated"
  | "milestoneWorktreeApplied"
  | "milestoneTaskCompleted"
  | "milestoneTaskInterrupted"
  | "milestoneWorkflowAdvanced"
>;

type Props = {
  modelRef: string;
  models: SelectOption[];
  policy: InspectorPolicy;
  maxSteps: number;
  command: string;
  running: boolean;
  events: RuntimeEvent[];
  lspCommand: string;
  lspArgs: string;
  lspLanguage: string;
  lspStatus: LSPStatus;
  lspDiagnosticPath: string;
  lspDiagnostics: LSPDiagnostic[];
  subagents: SubagentNode[];
  workspaceOpen: boolean;
  selectedSessionId: string;
  busy: boolean;
  labels: RunSettingsLabels;
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

// The Run pane (Demo RunPane): provider and model, permissions and the step budget, the subagent
// tree, LSP, the debug shell and the bounded event list. Every control goes straight to Core.
export function RunSettingsPanel({
  modelRef,
  models,
  policy,
  maxSteps,
  command,
  running,
  events,
  lspCommand,
  lspArgs,
  lspLanguage,
  lspStatus,
  lspDiagnosticPath,
  lspDiagnostics,
  subagents,
  workspaceOpen,
  selectedSessionId,
  busy,
  labels,
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
    <div className="tp-pane">
      <InspectorSection title={labels.provider}>
        <label className="field">
          <span className="field-label">{labels.modelSelect}</span>
          <DesktopSelect
            ariaLabel={labels.modelSelect}
            value={modelRef}
            placeholder={labels.noModels}
            options={models}
            search={{
              ariaLabel: labels.modelSearch,
              placeholder: labels.modelSearch,
              emptyLabel: labels.noModelMatches,
            }}
            onChange={onModelChange}
            popoverPlacement="bottom"
            className="tp-select"
          />
        </label>
        <button className="link-btn" type="button" onClick={onOpenProviders}>
          {labels.providerConfig}
        </button>
        <p className="tp-pane-muted">{labels.runSettingsNote}</p>
      </InspectorSection>

      <InspectorSection title={labels.run}>
        <label className="field">
          <span className="field-label">{labels.policy}</span>
          <DesktopSelect
            ariaLabel={labels.policy}
            value={policy}
            placeholder={labels.workspace}
            options={[
              { value: "read-only", label: labels.readOnly, description: labels.readOnlyDescription },
              { value: "workspace", label: labels.workspace, description: labels.workspaceDescription },
              { value: "full", label: labels.full, description: labels.fullDescription },
            ]}
            onChange={(value) => onPolicyChange(value as InspectorPolicy)}
            popoverPlacement="bottom"
            className="tp-select"
          />
        </label>
        <label className="field">
          <span className="field-label">{labels.maxSteps}</span>
          <input
            className="input"
            type="number"
            min={1}
            max={200}
            aria-label={labels.maxSteps}
            value={maxSteps}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onMaxStepsChange(Math.max(1, Number(event.target.value) || 1))}
          />
        </label>
      </InspectorSection>

      {selectedSessionId && (
        <SubagentTreePanel
          nodes={subagents}
          labels={{
            title: labels.subagents,
            empty: labels.noSubagents,
            active: labels.subagentActive,
            completed: labels.subagentCompleted,
            interrupted: labels.subagentInterrupted,
            imported: labels.subagentImported,
          }}
          onOpenSession={onOpenSubagent}
        />
      )}

      <LSPSettingsPanel
        command={lspCommand}
        args={lspArgs}
        language={lspLanguage}
        status={lspStatus}
        diagnosticPath={lspDiagnosticPath}
        diagnostics={lspDiagnostics}
        busy={busy}
        workspaceOpen={workspaceOpen}
        labels={labels}
        onCommandChange={onLSPCommandChange}
        onArgsChange={onLSPArgsChange}
        onLanguageChange={onLSPLanguageChange}
        onDiagnosticPathChange={onLSPDiagnosticPathChange}
        onRefreshDiagnostics={onRefreshLSPDiagnostics}
        onStart={onStartLSP}
        onStop={onStopLSP}
      />

      <InspectorSection title={labels.terminal}>
        <form className="shell-form" onSubmit={onRunShell}>
          <textarea
            className="mono"
            aria-label={labels.shellCommand}
            value={command}
            rows={4}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onCommandChange(event.target.value)}
            disabled={!selectedSessionId || running}
          />
          <button
            className="btn btn-sm btn-secondary"
            type="submit"
            disabled={busy || !selectedSessionId || running || !command.trim()}
          >
            {labels.runCommand}
          </button>
        </form>
        <p className="tp-pane-muted">{labels.shellHint}</p>
      </InspectorSection>

      <InspectorSection title={labels.activity}>
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
      </InspectorSection>
    </div>
  );
}
