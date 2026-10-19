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
import { ChecksPanel } from "./ChecksPanel";
import { Inspector } from "./Inspector";
import { TaskStatePanel } from "./TaskStatePanel";
import { WindowPane } from "./WindowPane";
import type { InspectorLabels, InspectorPolicy, InspectorTab } from "./inspector-types";

type Props = {
  tab: InspectorTab;
  events: RuntimeEvent[];
  modelRef: string;
  models: SelectOption[];
  // Shown when modelRef is not one of models (none configured, or a pinned model that is unavailable).
  modelPlaceholder: string;
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
  // The global configuration digest: the Checks panel re-reads when it changes (trust adds checks).
  configKey: string;
  trusting: boolean;
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
  onTrustWorkspace: () => void;
};

export function WorkspaceInspector({
  tab,
  events,
  modelRef,
  models,
  modelPlaceholder,
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
  configKey,
  trusting,
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
  onTrustWorkspace,
}: Props) {
  return (
    <Inspector
      tab={tab}
      events={events}
      modelRef={modelRef}
      models={models}
      policy={policy}
      maxSteps={maxSteps}
      command={command}
      lspCommand={lspCommand}
      lspArgs={lspArgs}
      lspLanguage={lspLanguage}
      lspStatus={lspStatus}
      lspDiagnosticPath={lspDiagnosticPath}
      lspDiagnostics={lspDiagnostics}
      subagents={subagents}
      workspaceOpen={workspaceOpen}
      selectedSessionId={selectedSessionId}
      running={running}
      busy={busy}
      taskPanel={
        <TaskStatePanel
          pane="task"
          sessionId={selectedSessionId}
          running={running}
          events={events}
          labels={labels}
          onOpenTask={onOpenSubagent}
        />
      }
      windowPanel={
        <WindowPane
          sessionId={selectedSessionId}
          running={running}
          events={events}
          health={health}
          pressure={pressure}
          checkpoints={checkpoints}
          labels={labels}
        />
      }
      checksPanel={
        <ChecksPanel
          sessionId={selectedSessionId}
          events={events}
          configKey={configKey}
          trusting={trusting}
          labels={labels}
          onTrust={onTrustWorkspace}
        />
      }
      labels={{ ...labels, noModels: modelPlaceholder } satisfies InspectorLabels}
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
