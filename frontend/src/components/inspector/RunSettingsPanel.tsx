import type { ChangeEvent } from "react";
import type { Health, LSPDiagnostic, LSPStatus, SessionCheckpoint, SubagentNode } from "../../types";
import { DesktopSelect, type SelectOption } from "../primitives/Select";
import { LSPSettingsPanel, type LSPSettingsLabels } from "./LSPSettingsPanel";
import { SubagentTreePanel } from "./SubagentTreePanel";
import type { InspectorPolicy } from "./inspector-types";

type RunSettingsLabels = LSPSettingsLabels & {
  provider: string;
  modelSelect: string;
  modelSearch: string;
  noModelMatches: string;
  noModels: string;
  providerConfig: string;
  envFallback: string;
  run: string;
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
  subagents: string;
  noSubagents: string;
  subagentActive: string;
  subagentCompleted: string;
  subagentInterrupted: string;
  subagentCheckpoint: string;
};

type Props = {
  modelRef: string;
  models: SelectOption[];
  policy: InspectorPolicy;
  maxSteps: number;
  health?: Health;
  pressure: number;
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
  busy: boolean;
  labels: RunSettingsLabels;
  onModelChange: (value: string) => void;
  onOpenProviders: () => void;
  onPolicyChange: (value: InspectorPolicy) => void;
  onMaxStepsChange: (value: number) => void;
  onLSPCommandChange: (value: string) => void;
  onLSPArgsChange: (value: string) => void;
  onLSPLanguageChange: (value: string) => void;
  onLSPDiagnosticPathChange: (value: string) => void;
  onRefreshLSPDiagnostics: () => void;
  onStartLSP: () => void;
  onStopLSP: () => void;
  onOpenSubagent: (sessionId: string) => void;
};

function bytes(value = 0) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function RunSettingsPanel({
  modelRef,
  models,
  policy,
  maxSteps,
  health,
  pressure,
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
  busy,
  labels,
  onModelChange,
  onOpenProviders,
  onPolicyChange,
  onMaxStepsChange,
  onLSPCommandChange,
  onLSPArgsChange,
  onLSPLanguageChange,
  onLSPDiagnosticPathChange,
  onRefreshLSPDiagnostics,
  onStartLSP,
  onStopLSP,
  onOpenSubagent,
}: Props) {
  return (
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
            search={{
              ariaLabel: labels.modelSearch,
              placeholder: labels.modelSearch,
              emptyLabel: labels.noModelMatches,
            }}
            onChange={onModelChange}
            popoverPlacement="bottom"
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
            popoverPlacement="bottom"
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
    </div>
  );
}
