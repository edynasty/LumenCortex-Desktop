import type { ChangeEvent, FormEvent } from "react";
import { ServerCog, SquareTerminal, X } from "lucide-react";
import type { Health, LSPDiagnostic, LSPStatus, RuntimeEvent, SessionCheckpoint, SubagentNode } from "../../types";
import { DesktopSelect, type SelectOption } from "../primitives/Select";
import { MilestoneList } from "./MilestoneList";
import { SubagentTreePanel } from "./SubagentTreePanel";

export type InspectorTab = "activity" | "run" | "terminal";
export type InspectorPolicy = "read-only" | "workspace" | "full";

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

function bytes(value = 0) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

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
          <div className="run-settings">
            <div className="settings-group">
              <div className="settings-title">{labels.provider}</div>
              <label className="settings-field">
                <span>{labels.modelSelect}</span>
                <DesktopSelect
                  ariaLabel={labels.modelSelect}
                  value={modelRef}
                  placeholder={labels.noModels}
                  options={models}
                  onChange={onModelChange}
                  className="settings-desktop-select"
                />
              </label>
              <button className="provider-link-button" type="button" onClick={onOpenProviders}>
                {labels.providerConfig}
              </button>
              <p className="settings-note">{labels.envFallback}</p>
            </div>

            <div className="settings-group">
              <div className="settings-title">{labels.run}</div>
              <label className="settings-field">
                <span>{labels.policy}</span>
                <DesktopSelect
                  ariaLabel={labels.policy}
                  value={policy}
                  placeholder={labels.workspace}
                  options={[
                    { value: "read-only", label: labels.readOnly },
                    { value: "workspace", label: labels.workspace },
                    { value: "full", label: labels.full },
                  ]}
                  onChange={(value) => onPolicyChange(value as InspectorPolicy)}
                  className="settings-desktop-select"
                />
              </label>
              <label>{labels.maxSteps}
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={maxSteps}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onMaxStepsChange(Math.max(1, Number(event.target.value) || 1))}
                />
              </label>
            </div>

            <div className="settings-group runtime-group">
              <div className="settings-title">{labels.runtime}</div>
              <dl>
                <div><dt>{labels.workingMemory}</dt><dd>{bytes(health?.usedBytes)}</dd></div>
                <div><dt>{labels.softBudget}</dt><dd>{bytes(health?.budget.softBytes)}</dd></div>
                <div><dt>{labels.hardBudget}</dt><dd>{bytes(health?.budget.hardBytes)}</dd></div>
                <div><dt>{labels.maxAgents}</dt><dd>{health?.budget.maxAgents ?? "—"}</dd></div>
              </dl>
              <div className="memory-meter"><span style={{ width: `${pressure}%` }} /></div>
            </div>

            {selectedSessionId && (
              <SubagentTreePanel
                nodes={subagents}
                checkpoints={checkpoints}
                labels={{
                  title: labels.subagents,
                  empty: labels.noSubagents,
                  active: labels.subagentActive,
                  completed: labels.subagentCompleted,
                  interrupted: labels.subagentInterrupted,
                  checkpoint: labels.subagentCheckpoint,
                }}
                onOpenSession={onOpenSubagent}
              />
            )}

            <div className="settings-group lsp-group">
              <div className="settings-title lsp-title">
                <span><ServerCog size={13} strokeWidth={1.7} aria-hidden /> {labels.lsp}</span>
                <span className={`lsp-status ${lspStatus.running ? "running" : "stopped"}`}>
                  {lspStatus.running ? labels.lspRunning : labels.lspStopped}
                </span>
              </div>

              <label className="settings-field">
                <span>{labels.lspCommand}</span>
                <input
                  value={lspCommand}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onLSPCommandChange(event.target.value)}
                  disabled={lspStatus.running}
                />
              </label>

              <label className="settings-field">
                <span>{labels.lspArgs}</span>
                <input
                  value={lspArgs}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onLSPArgsChange(event.target.value)}
                  disabled={lspStatus.running}
                />
              </label>

              <label className="settings-field">
                <span>{labels.lspLanguage}</span>
                <input
                  value={lspLanguage}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onLSPLanguageChange(event.target.value)}
                  disabled={lspStatus.running}
                />
              </label>

              <dl className="lsp-stats">
                <div><dt>{labels.lspPid}</dt><dd>{lspStatus.pid || "—"}</dd></div>
                <div><dt>{labels.lspPending}</dt><dd>{lspStatus.pendingRequests ?? 0}</dd></div>
                <div><dt>{labels.lspDiagnostics}</dt><dd>{lspStatus.diagnostics ?? 0}</dd></div>
              </dl>

              <label className="settings-field">
                <span>{labels.lspDiagnosticPath}</span>
                <input
                  value={lspDiagnosticPath}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onLSPDiagnosticPathChange(event.target.value)}
                  placeholder="frontend/src/App.tsx"
                  disabled={!lspStatus.running}
                />
              </label>

              <button
                className="secondary-action"
                type="button"
                disabled={busy || !lspStatus.running || !lspDiagnosticPath.trim()}
                onClick={onRefreshLSPDiagnostics}
              >
                {labels.lspDiagnosticRefresh}
              </button>

              {lspDiagnosticPath.trim() && (
                <div className="lsp-diagnostic-list">
                  {lspDiagnostics.length ? lspDiagnostics.map((item, index) => {
                    const severity =
                      item.severity === 1 ? labels.lspSeverityError :
                      item.severity === 2 ? labels.lspSeverityWarning :
                      item.severity === 3 ? labels.lspSeverityInfo :
                      labels.lspSeverityHint;
                    return (
                      <div className="lsp-diagnostic-item" key={index}>
                        <div>
                          <strong>{severity}</strong>
                          <code>{item.range.start.line + 1}:{item.range.start.character + 1}</code>
                        </div>
                        <p>{item.message}</p>
                      </div>
                    );
                  }) : (
                    <p className="lsp-empty">{labels.lspNoDiagnostics}</p>
                  )}
                </div>
              )}

              {lspStatus.lastError && (
                <p className="lsp-error"><strong>{labels.lspLastError}</strong> {lspStatus.lastError}</p>
              )}

              <button
                className="secondary-action"
                type="button"
                disabled={busy || !workspaceOpen || (!lspStatus.running && !lspCommand.trim())}
                onClick={lspStatus.running ? onStopLSP : onStartLSP}
              >
                {lspStatus.running ? labels.lspStop : labels.lspStart}
              </button>
            </div>
          </div>
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
