import { Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { LSPDiagnostic, LSPStatus, RuntimeEvent, SubagentNode } from "../../types";
import { Icon } from "../primitives/Icon";
import { IconButton } from "../primitives/IconButton";
import { SegmentedControl } from "../primitives/SegmentedControl";
import type { SelectOption } from "../primitives/Select";
import { RunSettingsPanel } from "./RunSettingsPanel";
import type { InspectorLabels, InspectorPolicy, InspectorTab, PolicyCeiling } from "./inspector-types";

type Props = {
  tab: InspectorTab;
  events: RuntimeEvent[];
  modelRef: string;
  models: SelectOption[];
  policy: InspectorPolicy;
  // The selected agent's ceiling; without it every grant stays available.
  agentCeiling?: PolicyCeiling;
  maxSteps: number;
  command: string;
  lspCommand: string;
  lspArgs: string;
  lspLanguage: string;
  lspStatus: LSPStatus;
  lspDiagnosticPath: string;
  lspDiagnostics: LSPDiagnostic[];
  subagents: SubagentNode[];
  workspaceOpen: boolean;
  selectedSessionId: string;
  running: boolean;
  busy: boolean;
  // The Task, Window and Checks panes; each loads and edits its own data.
  taskPanel: ReactNode;
  filesPanel: ReactNode;
  terminalPanel: ReactNode;
  windowPanel: ReactNode;
  checksPanel: ReactNode;
  labels: InspectorLabels;
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

// Inspector is the thread panel (Demo "Lumen Glass"): a compact segmented tab strip — Task ·
// Files · Terminal · Window · Checks · Run — and a scrollable body of quiet sections. Legacy tab
// ids stay valid:
export function Inspector({
  tab,
  events,
  modelRef,
  models,
  policy,
  agentCeiling,
  maxSteps,
  command,
  lspCommand,
  lspArgs,
  lspLanguage,
  lspStatus,
  lspDiagnosticPath,
  lspDiagnostics,
  subagents,
  workspaceOpen,
  selectedSessionId,
  running,
  busy,
  taskPanel,
  filesPanel,
  terminalPanel,
  windowPanel,
  checksPanel,
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
  // The terminal pane is mounted on first visit and then kept, so switching tabs does not kill a
  // running command.
  const [terminalMounted, setTerminalMounted] = useState(tab === "terminal");
  useEffect(() => {
    if (tab === "terminal") setTerminalMounted(true);
  }, [tab]);

  const tabs: { value: InspectorTab; label: string }[] = [
    { value: "task", label: labels.task },
    { value: "files", label: labels.files },
    { value: "terminal", label: labels.terminal },
    { value: "window", label: labels.windowTab },
    { value: "checks", label: labels.checks },
    { value: "run", label: labels.run },
  ];
  return (
    <aside className="sheet inspector" aria-label={labels.inspector}>
      <header className="inspector-head">
        <SegmentedControl
          size="sm"
          ariaLabel={labels.inspector}
          value={tab}
          options={tabs}
          onChange={onTabChange}
        />
        <span className="toolbar-spacer" />
        <IconButton label={labels.close} size="sm" icon={<Icon name="close" size={14} />} onClick={onClose} />
      </header>
      <div className="inspector-body">
        {tab === "task" && <div className="tp-pane">{taskPanel}</div>}
        {tab === "files" && filesPanel}
        {terminalMounted ? (
          <div className="inspector-terminal" hidden={tab !== "terminal"}>
            <Suspense fallback={<p className="tp-pane-muted files-note">{labels.terminalStarting}</p>}>{terminalPanel}</Suspense>
          </div>
        ) : null}
        {tab === "window" && windowPanel}
        {tab === "checks" && <div className="tp-pane">{checksPanel}</div>}
        {tab === "run" && (
          <RunSettingsPanel
            modelRef={modelRef}
            models={models}
            policy={policy}
            agentCeiling={agentCeiling}
            maxSteps={maxSteps}
            command={command}
            running={running}
            events={events}
            lspCommand={lspCommand}
            lspArgs={lspArgs}
            lspLanguage={lspLanguage}
            lspStatus={lspStatus}
            lspDiagnosticPath={lspDiagnosticPath}
            lspDiagnostics={lspDiagnostics}
            subagents={subagents}
            workspaceOpen={workspaceOpen}
            selectedSessionId={selectedSessionId}
            busy={busy}
            labels={labels}
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
        )}
      </div>
    </aside>
  );
}
