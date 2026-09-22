import { Plus, RefreshCw, Server, Square, Trash2 } from "lucide-react";
import type { MCPProtocolMode } from "../../types";
import { Button } from "../primitives/Button";
import { Dialog } from "../primitives/Dialog";
import { EmptyState } from "../primitives/EmptyState";
import { DesktopSelect } from "../primitives/Select";
import type { ExtensionsLabels } from "./extensions-types";
import type { useMCPWorkspaceController } from "./useMCPWorkspaceController";

type Props = {
  workspace: string;
  labels: ExtensionsLabels;
  controller: ReturnType<typeof useMCPWorkspaceController>;
};

export function MCPWorkspacePanel({ workspace, labels, controller }: Props) {
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
    beginNew,
    saveConfig,
    deleteConfig,
    toggleServer,
    refreshTools,
  } = controller;

  return (
    <>
      <div className="extensions-layout">
        <aside className="mcp-server-list">
          <div className="mcp-list-head">
            <strong>{labels.mcpServers}</strong>
            <Button icon={<Plus size={12} />} onClick={beginNew}>{labels.addServer}</Button>
          </div>

          <div className="mcp-list-body">
            {configs.map((config) => {
              const status = statusById.get(config.id);
              return (
                <button
                  type="button"
                  key={config.id}
                  className={config.id === selectedId ? "selected" : ""}
                  onClick={() => setSelectedId(config.id)}
                >
                  <span className={`mcp-server-dot ${status?.running ? "running" : ""} ${config.disabled ? "disabled" : ""}`} />
                  <span>
                    <strong>{config.name || config.id}</strong>
                    <small>
                      {config.disabled ? labels.disabled : status?.running ? labels.running : labels.stopped}
                      {" · "}
                      {projectConfigs.some((item) => item.id === config.id) ? labels.projectSource : labels.globalSource}
                    </small>
                  </span>
                  <code>{status?.tools ?? 0}</code>
                </button>
              );
            })}

            {!configs.length && (
              <EmptyState
                icon={<Server size={20} />}
                title={labels.noServers}
                body={labels.noAutoStart}
              />
            )}
          </div>
        </aside>

        <div className="mcp-detail">
          <div className="mcp-scope-bar">
            <button
              type="button"
              className={scope === "global" ? "active" : ""}
              onClick={() => setScope("global")}
            >
              <span>{labels.globalScope}</span>
              <small>{labels.globalScopeHint}</small>
            </button>
            <button
              type="button"
              className={scope === "project" ? "active" : ""}
              onClick={() => setScope("project")}
            >
              <span>{labels.projectScope}</span>
              <small>{labels.projectScopeHint}</small>
            </button>
          </div>

          <section className="mcp-config-section">
            <div className="mcp-section-head">
              <div>
                <strong>{selectedId || labels.addServer}</strong>
                <span>{inherited ? labels.inherited : labels.noAutoStart}</span>
              </div>
              <div>
                {selectedId && selectedScopedConfig && (
                  <Button
                    variant="danger"
                    icon={<Trash2 size={12} />}
                    disabled={busy}
                    onClick={() => setDeleteOpen(true)}
                  >
                    {labels.delete}
                  </Button>
                )}
              </div>
            </div>

            <div className="mcp-form-grid">
              <label>
                <span>{labels.serverId}</span>
                <input
                  value={draft.id}
                  disabled={Boolean(selectedId)}
                  onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))}
                />
              </label>
              <label>
                <span>{labels.serverName}</span>
                <input
                  value={draft.name || ""}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label className="wide">
                <span>{labels.command}</span>
                <input
                  value={draft.command}
                  onChange={(event) => setDraft((current) => ({ ...current, command: event.target.value }))}
                />
              </label>
              <label className="wide">
                <span>{labels.args}</span>
                <input value={argsText} onChange={(event) => setArgsText(event.target.value)} />
              </label>
              <label>
                <span>{labels.enabled}</span>
                <button
                  type="button"
                  className={`mcp-enable-toggle ${draft.disabled ? "off" : "on"}`}
                  aria-pressed={!draft.disabled}
                  onClick={() => setDraft((current) => ({ ...current, disabled: !current.disabled }))}
                >
                  <span />
                  <strong>{draft.disabled ? labels.disabled : labels.enabled}</strong>
                </button>
              </label>
              <label>
                <span>{labels.protocol}</span>
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
                  className="settings-desktop-select"
                />
              </label>
            </div>

            <div className="mcp-form-actions">
              <Button
                variant="primary"
                disabled={busy || !workspace || !draft.id.trim() || !draft.command.trim()}
                onClick={() => void saveConfig()}
              >
                {labels.save}
              </Button>
            </div>
          </section>

          {selectedId ? (
            <>
              <section className="mcp-runtime-section">
                <div className="mcp-section-head">
                  <div>
                    <strong>{selectedStatus?.running ? labels.running : labels.stopped}</strong>
                    <span>{selectedStatus?.protocolVersion || draft.protocolMode || "legacy"}</span>
                  </div>
                  <div className="mcp-runtime-actions">
                    {selectedStatus?.running && (
                      <Button
                        icon={<RefreshCw size={12} />}
                        disabled={busy}
                        onClick={() => void refreshTools()}
                      >
                        {labels.refresh}
                      </Button>
                    )}
                    <Button
                      variant={selectedStatus?.running ? "danger" : "primary"}
                      icon={selectedStatus?.running ? <Square size={11} /> : <Server size={12} />}
                      disabled={busy || Boolean(draft.disabled)}
                      onClick={() => void toggleServer()}
                    >
                      {selectedStatus?.running ? labels.stop : labels.start}
                    </Button>
                  </div>
                </div>

                <dl className="mcp-runtime-stats">
                  <div><dt>{labels.pid}</dt><dd>{selectedStatus?.pid || "—"}</dd></div>
                  <div><dt>{labels.pending}</dt><dd>{selectedStatus?.pendingRequests ?? 0}</dd></div>
                  <div><dt>{labels.tools}</dt><dd>{selectedStatus?.tools ?? 0}</dd></div>
                </dl>

                {selectedStatus?.lastError && (
                  <p className="mcp-runtime-error">
                    <strong>{labels.lastError}</strong> {selectedStatus.lastError}
                  </p>
                )}
              </section>

              <section className="mcp-tools-section">
                <div className="mcp-section-head">
                  <div>
                    <strong>{labels.tools}</strong>
                    <span>{selectedTools.length}</span>
                  </div>
                </div>
                <div className="mcp-tools-list">
                  {selectedTools.map((tool) => (
                    <div className="mcp-tool-row" key={tool.name}>
                      <div>
                        <code>{tool.toolName}</code>
                        {tool.description && <span>{tool.description}</span>}
                      </div>
                      <small className={tool.readOnly ? "read-only" : "side-effect"}>
                        {tool.readOnly ? labels.readOnly : labels.sideEffect}
                      </small>
                    </div>
                  ))}
                  {!selectedTools.length && (
                    <div className="mcp-tools-empty">{labels.noTools}</div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <EmptyState icon={<Server size={20} />} title={labels.selectServer} />
          )}
        </div>
      </div>

      <Dialog
        open={deleteOpen}
        title={labels.deleteTitle}
        description={labels.deleteBody}
        onOpenChange={setDeleteOpen}
        footer={
          <>
            <Button onClick={() => setDeleteOpen(false)}>{labels.cancel}</Button>
            <Button variant="danger" disabled={busy} onClick={() => void deleteConfig()}>
              {labels.delete}
            </Button>
          </>
        }
      />
    </>
  );
}
