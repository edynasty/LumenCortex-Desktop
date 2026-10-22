import { useState } from "react";
import type { MCPProtocolMode } from "../../types";
import { Button } from "../primitives/Button";
import { Dialog } from "../primitives/Dialog";
import { Icon } from "../primitives/Icon";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { DesktopSelect } from "../primitives/Select";
import type { ExtensionsLabels } from "./extensions-types";
import { MCPToolList } from "./MCPToolList";
import type { MCPWorkspaceController } from "./useMCPWorkspaceController";

type Props = {
  workspace: string;
  labels: ExtensionsLabels;
  controller: MCPWorkspaceController;
  /** The open workspace's trust, from the app's one trust source (ConfigState.trusted). */
  trusted: boolean;
  trusting: boolean;
  onTrust: () => void;
};

/** MCP pane: Demo settings-sheet style — scope toolbar, provider-style server list, editor column. */
export function MCPWorkspacePanel({ workspace, labels, controller, trusted, trusting, onTrust }: Props) {
  const {
    configs,
    projectConfigs,
    scope,
    setScope,
    selectedId,
    setSelectedId,
    draft,
    setDraft,
    argsText,
    setArgsText,
    busy,
    deleteOpen,
    setDeleteOpen,
    selectedScopedConfig,
    inherited,
    statusById,
    selectedStatus,
    selectedTools,
    selectedScope,
    selectedBlocked,
    startRefused,
    clearStartRefused,
    beginNew,
    saveConfig,
    deleteConfig,
    toggleServer,
    refreshTools,
    setToolPermission,
  } = controller;

  // "Add server" clears the selection; track that intent so an empty catalogue still
  // switches the editor column from the empty state to the creation form.
  const [creating, setCreating] = useState(false);
  const startNew = () => {
    beginNew();
    setCreating(true);
  };
  const select = (id: string) => {
    setSelectedId(id);
    setCreating(false);
  };

  const running = Boolean(selectedStatus?.running);
  const showEditor = Boolean(selectedId) || creating || configs.length > 0;

  return (
    <>
      <div className="pane-toolbar">
        <SegmentedControl
          ariaLabel={labels.mcpServers}
          value={scope}
          onChange={setScope}
          options={[
            { value: "global", label: labels.globalScope, title: labels.globalScope },
            { value: "project", label: labels.projectScope, title: labels.projectScope },
          ]}
        />
        <span className="pane-hint">{scope === "global" ? labels.globalScopeHint : labels.projectScopeHint}</span>
      </div>

      <div className="provider-layout">
        <ul className="provider-list">
          {configs.map((config) => {
            const status = statusById.get(config.id);
            const isRunning = Boolean(status?.running && !config.disabled);
            return (
              <li key={config.id}>
                <button
                  type="button"
                  className={`provider-row ${config.id === selectedId ? "is-selected" : ""}`}
                  onClick={() => select(config.id)}
                >
                  <span className="provider-row-name">
                    <span className={`run-dot ${isRunning ? "is-on" : ""}`} aria-hidden />
                    {config.name || config.id}
                  </span>
                  <span className="provider-row-sub">
                    {config.disabled ? labels.disabled : status?.running ? labels.running : labels.stopped}
                    {" · "}
                    {(config.scope ?? (projectConfigs.some((item) => item.id === config.id) ? "project" : "global")) === "project"
                      ? labels.projectSource
                      : labels.globalSource}
                    {config.blockedByTrust && (
                      <>
                        {" · "}
                        <span className="tone-warn">{labels.trustRequired}</span>
                      </>
                    )}
                    {" · "}
                    {status?.tools ?? 0} {labels.tools}
                  </span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              className={`provider-row is-add ${!selectedId && creating ? "is-selected" : ""}`}
              onClick={startNew}
            >
              <Icon name="plus" size={14} />
              {labels.addServer}
            </button>
          </li>
        </ul>

        {!showEditor ? (
          <div className="empty-state">
            <Icon name="mcp" size={22} />
            <h3>{labels.noServers}</h3>
            <p>{labels.noAutoStart}</p>
            <Button variant="secondary" size="sm" icon={<Icon name="plus" size={14} />} onClick={startNew}>
              {labels.addServer}
            </Button>
          </div>
        ) : (
          <div className="extensions-editor">
            <div className="extensions-editor-head">
              <div className="extensions-editor-id">
                <strong>{selectedId || labels.addServer}</strong>
                <span className="mono">
                  {selectedId && inherited ? labels.inherited : labels.noAutoStart}
                </span>
              </div>
              {selectedId && selectedScopedConfig && (
                <div className="extensions-editor-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="is-danger"
                    aria-label={labels.delete}
                    title={labels.delete}
                    disabled={busy}
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Icon name="delete" size={13} />
                  </Button>
                </div>
              )}
            </div>

            <div className="form-grid">
              <label className="field">
                <span className="field-label">{labels.serverId}</span>
                <input
                  className="input mono"
                  value={draft.id}
                  disabled={Boolean(selectedId)}
                  onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field-label">{labels.serverName}</span>
                <input
                  className="input"
                  value={draft.name || ""}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label className="field span-2">
                <span className="field-label">{labels.command}</span>
                <input
                  className="input mono"
                  value={draft.command}
                  onChange={(event) => setDraft((current) => ({ ...current, command: event.target.value }))}
                />
              </label>
              <label className="field span-2">
                <span className="field-label">{labels.args}</span>
                <input
                  className="input mono"
                  value={argsText}
                  onChange={(event) => setArgsText(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">{labels.enabled}</span>
                <button
                  type="button"
                  className="switch"
                  role="switch"
                  aria-checked={!draft.disabled}
                  aria-label={labels.enabled}
                  onClick={() => setDraft((current) => ({ ...current, disabled: !current.disabled }))}
                >
                  <span />
                </button>
              </label>
              <label className="field">
                <span className="field-label">{labels.protocol}</span>
                <DesktopSelect
                  ariaLabel={labels.protocol}
                  value={draft.protocolMode || "legacy"}
                  placeholder={labels.legacy}
                  options={[
                    { value: "legacy", label: labels.legacy },
                    { value: "modern", label: labels.modern },
                  ]}
                  onChange={(value) => setDraft((current) => ({
                    ...current,
                    protocolMode: value as MCPProtocolMode,
                  }))}
                />
              </label>
            </div>

            <footer className="editor-actions">
              <Button
                variant="primary"
                size="sm"
                disabled={busy || !workspace || !draft.id.trim() || !draft.command.trim()}
                onClick={() => void saveConfig()}
              >
                {labels.save}
              </Button>
            </footer>

            {selectedId ? (
              <>
                <h5 className="subhead">{running ? labels.running : labels.stopped}</h5>
                <div className="extensions-runtime-row">
                  <span className={`badge ${running ? "tone-ok" : ""} mono`}>
                    {selectedStatus?.protocolVersion || draft.protocolMode || "legacy"}
                  </span>
                  <span className="toolbar-spacer" />
                  {running && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Icon name="refresh" size={13} />}
                      disabled={busy}
                      onClick={() => void refreshTools()}
                    >
                      {labels.refresh}
                    </Button>
                  )}
                  <Button
                    variant={running ? "secondary" : "primary"}
                    size="sm"
                    icon={<Icon name={running ? "stop" : "send"} size={13} />}
                    // A project server that was started while the workspace was trusted keeps running
                    // after trust is withdrawn, so Stop stays available; only Start is refused.
                    disabled={busy || (!running && (Boolean(draft.disabled) || selectedBlocked))}
                    title={!running && selectedBlocked ? labels.trustRequired : undefined}
                    onClick={() => void toggleServer()}
                  >
                    {running ? labels.stop : labels.start}
                  </Button>
                </div>

                {(selectedBlocked || startRefused) && (
                  <p className="extensions-note" role="status">
                    <Icon name="lock" size={13} />
                    <span>{labels.trustRequired}</span>
                    <span className="toolbar-spacer" />
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={trusting}
                      onClick={() => {
                        clearStartRefused();
                        onTrust();
                      }}
                    >
                      {trusting ? labels.trustingWorkspace : labels.trustWorkspace}
                    </Button>
                  </p>
                )}

                <dl className="extensions-stats">
                  <div><dt>{labels.pid}</dt><dd className="mono">{selectedStatus?.pid || "—"}</dd></div>
                  <div><dt>{labels.pending}</dt><dd className="mono">{selectedStatus?.pendingRequests ?? 0}</dd></div>
                  <div><dt>{labels.tools}</dt><dd className="mono">{selectedStatus?.tools ?? 0}</dd></div>
                </dl>

                {selectedStatus?.lastError && (
                  <p className="extensions-error">
                    <Icon name="failed" size={13} />
                    <span><strong>{labels.lastError}</strong> {selectedStatus.lastError}</span>
                  </p>
                )}

                <MCPToolList
                  labels={labels}
                  tools={selectedTools}
                  overrides={draft.tools || {}}
                  scope={selectedScope}
                  trusted={trusted}
                  busy={busy}
                  onSetPermission={(toolName, permission) => void setToolPermission(toolName, permission)}
                />
              </>
            ) : !creating ? (
              <div className="empty-state">
                <Icon name="mcp" size={22} />
                <h3>{labels.selectServer}</h3>
                <p>{labels.noAutoStart}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <Dialog
        open={deleteOpen}
        title={labels.deleteTitle}
        description={labels.deleteBody}
        onOpenChange={setDeleteOpen}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleteOpen(false)}>
              {labels.cancel}
            </Button>
            <Button variant="danger" size="sm" disabled={busy} onClick={() => void deleteConfig()}>
              {labels.delete}
            </Button>
          </>
        }
      />
    </>
  );
}
