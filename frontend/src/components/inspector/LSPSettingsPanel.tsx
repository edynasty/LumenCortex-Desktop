import type { ChangeEvent } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { LSPDiagnostic, LSPStatus } from "../../types";
import { InspectorSection } from "./Section";

export type LSPSettingsLabels = Pick<
  AppCopy,
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
>;

type Props = {
  command: string;
  args: string;
  language: string;
  status: LSPStatus;
  diagnosticPath: string;
  diagnostics: LSPDiagnostic[];
  busy: boolean;
  workspaceOpen: boolean;
  labels: LSPSettingsLabels;
  onCommandChange: (value: string) => void;
  onArgsChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onDiagnosticPathChange: (value: string) => void;
  onRefreshDiagnostics: () => void;
  onStart: () => void;
  onStop: () => void;
};

export function LSPSettingsPanel({
  command,
  args,
  language,
  status,
  diagnosticPath,
  diagnostics,
  busy,
  workspaceOpen,
  labels,
  onCommandChange,
  onArgsChange,
  onLanguageChange,
  onDiagnosticPathChange,
  onRefreshDiagnostics,
  onStart,
  onStop,
}: Props) {
  return (
    <InspectorSection
      title={labels.lsp}
      action={
        <span className={`lsp-status ${status.running ? "running" : "stopped"}`}>
          {status.running ? labels.lspRunning : labels.lspStopped}
        </span>
      }
    >
      <label className="field">
        <span className="field-label">{labels.lspCommand}</span>
        <input
          className="input mono"
          value={command}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onCommandChange(event.target.value)}
          disabled={status.running}
        />
      </label>

      <label className="field">
        <span className="field-label">{labels.lspArgs}</span>
        <input
          className="input mono"
          value={args}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onArgsChange(event.target.value)}
          disabled={status.running}
        />
      </label>

      <label className="field">
        <span className="field-label">{labels.lspLanguage}</span>
        <input
          className="input mono"
          value={language}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onLanguageChange(event.target.value)}
          disabled={status.running}
        />
      </label>

      <dl className="lsp-stats">
        <div><dt>{labels.lspPid}</dt><dd>{status.pid || "—"}</dd></div>
        <div><dt>{labels.lspPending}</dt><dd>{status.pendingRequests ?? 0}</dd></div>
        <div><dt>{labels.lspDiagnostics}</dt><dd>{status.diagnostics ?? 0}</dd></div>
      </dl>

      <label className="field">
        <span className="field-label">{labels.lspDiagnosticPath}</span>
        <input
          className="input mono"
          value={diagnosticPath}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onDiagnosticPathChange(event.target.value)}
          placeholder="frontend/src/App.tsx"
          disabled={!status.running}
        />
      </label>

      <button
        className="btn btn-sm btn-secondary"
        type="button"
        disabled={busy || !status.running || !diagnosticPath.trim()}
        onClick={onRefreshDiagnostics}
      >
        {labels.lspDiagnosticRefresh}
      </button>

      {diagnosticPath.trim() && (
        <div className="lsp-diagnostic-list">
          {diagnostics.length ? diagnostics.map((item, index) => {
            const severity =
              item.severity === 1 ? labels.lspSeverityError :
              item.severity === 2 ? labels.lspSeverityWarning :
              item.severity === 3 ? labels.lspSeverityInfo :
              labels.lspSeverityHint;
            return (
              <div className="lsp-diagnostic-item" key={index}>
                <div>
                  <strong>{severity}</strong>
                  <code className="mono">{item.range.start.line + 1}:{item.range.start.character + 1}</code>
                </div>
                <p>{item.message}</p>
              </div>
            );
          }) : (
            <p className="lsp-empty">{labels.lspNoDiagnostics}</p>
          )}
        </div>
      )}

      {status.lastError && (
        <p className="lsp-error"><strong>{labels.lspLastError}</strong> {status.lastError}</p>
      )}

      <button
        className="btn btn-sm btn-secondary"
        type="button"
        disabled={busy || !workspaceOpen || (!status.running && !command.trim())}
        onClick={status.running ? onStop : onStart}
      >
        {status.running ? labels.lspStop : labels.lspStart}
      </button>
    </InspectorSection>
  );
}
