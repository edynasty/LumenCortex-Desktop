import type { ChangeEvent, FormEvent } from "react";
import { SquareTerminal, X } from "lucide-react";
import type { Health, RuntimeEvent } from "../../types";
import { DesktopSelect, type SelectOption } from "../primitives/Select";

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
  };
  onTabChange: (tab: InspectorTab) => void;
  onClose: () => void;
  onModelChange: (value: string) => void;
  onOpenProviders: () => void;
  onPolicyChange: (value: InspectorPolicy) => void;
  onMaxStepsChange: (value: number) => void;
  onCommandChange: (value: string) => void;
  onRunShell: (event: FormEvent<HTMLFormElement>) => void;
};

function bytes(value = 0) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatClock(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
          <div className="activity-list">
            {events.slice().reverse().map((event) => (
              <div className="activity-item" key={`${event.seq}-${event.at}`}>
                <div className="activity-rail"><span /></div>
                <div className="activity-copy">
                  <div><strong>{event.type}</strong><time>{formatClock(event.at)}</time></div>
                  {event.data && <code>{JSON.stringify(event.data)}</code>}
                </div>
              </div>
            ))}
            {!events.length && <div className="inspector-empty">{labels.noActivity}</div>}
          </div>
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
