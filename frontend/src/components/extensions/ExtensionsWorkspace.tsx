import { Plus, RefreshCw, Server, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { bridge } from "../../lib/bridge";
import { joinCommandArgs, splitCommandArgs } from "../../lib/command-line";
import type { MCPAgentTool, MCPConfig, MCPProtocolMode, MCPStatus, SessionRuntime } from "../../types";
import { Button } from "../primitives/Button";
import { Dialog } from "../primitives/Dialog";
import { EmptyState } from "../primitives/EmptyState";
import { DesktopSelect } from "../primitives/Select";
import { RuntimeIdentity } from "../runtime/RuntimeIdentity";
import "./extensions.css";

type Labels = {
  title: string;
  subtitle: string;
  mcpServers: string;
  addServer: string;
  noServers: string;
  serverId: string;
  serverName: string;
  command: string;
  args: string;
  protocol: string;
  legacy: string;
  modern: string;
  save: string;
  delete: string;
  deleteTitle: string;
  deleteBody: string;
  cancel: string;
  start: string;
  stop: string;
  refresh: string;
  running: string;
  stopped: string;
  pid: string;
  pending: string;
  tools: string;
  noTools: string;
  readOnly: string;
  sideEffect: string;
  noAutoStart: string;
  currentRuntime: string;
  localRuntime: string;
  worktreeRuntime: string;
  lastError: string;
  selectServer: string;
  enabled: string;
  disabled: string;
};

type Props = {
  workspace: string;
  sessionId: string;
  runtime: SessionRuntime;
  labels: Labels;
  onError: (message: string) => void;
};

const emptyConfig = (): MCPConfig => ({
  id: "",
  name: "",
  command: "",
  args: [],
  protocolMode: "legacy",
  disabled: false,
});

export function ExtensionsWorkspace({ workspace, sessionId, runtime, labels, onError }: Props) {
  const [configs, setConfigs] = useState<MCPConfig[]>([]);
  const [statuses, setStatuses] = useState<MCPStatus[]>([]);
  const [tools, setTools] = useState<MCPAgentTool[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<MCPConfig>(emptyConfig);
  const [argsText, setArgsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspace) {
      setConfigs([]);
      setStatuses([]);
      setTools([]);
      return;
    }
    try {
      const [nextConfigs, nextStatuses, nextTools] = await Promise.all([
        bridge.mcpConfigs(),
        bridge.mcpStatuses(sessionId),
        bridge.mcpTools(sessionId),
      ]);
      setConfigs(nextConfigs);
      setStatuses(nextStatuses);
      setTools(nextTools);
      setSelectedId((current) => {
        if (current && nextConfigs.some((config) => config.id === current)) return current;
        return nextConfigs[0]?.id || "";
      });
    } catch (err) {
      onError(String(err));
    }
  }, [onError, sessionId, workspace]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const config = configs.find((item) => item.id === selectedId);
    if (!config) {
      setDraft(emptyConfig());
      setArgsText("");
      return;
    }
    setDraft({ ...config, args: [...(config.args || [])] });
    setArgsText(joinCommandArgs(config.args));
  }, [configs, selectedId]);

  const statusById = useMemo(
    () => new Map(statuses.map((status) => [status.id, status])),
    [statuses]
  );
  const selectedStatus = selectedId ? statusById.get(selectedId) : undefined;
  const selectedTools = useMemo(
    () => tools.filter((tool) => tool.serverId === selectedId),
    [selectedId, tools]
  );

  function beginNew() {
    setSelectedId("");
    setDraft(emptyConfig());
    setArgsText("");
  }

  async function saveConfig() {
    const id = draft.id.trim();
    const command = draft.command.trim();
    if (!id || !command || busy) return;
    setBusy(true);
    try {
      await bridge.saveMCPConfig({
        ...draft,
        id,
        name: draft.name?.trim() || undefined,
        command,
        args: splitCommandArgs(argsText),
        protocolMode: (draft.protocolMode || "legacy") as MCPProtocolMode,
      });
      await refresh();
      setSelectedId(id);
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function deleteConfig() {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      await bridge.deleteMCPConfig(selectedId);
      setDeleteOpen(false);
      setSelectedId("");
      await refresh();
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleServer() {
    if (!selectedId || busy) return;
    setBusy(true);
    try {
      if (selectedStatus?.running) {
        await bridge.stopMCP(sessionId, selectedId);
      } else {
        await bridge.startMCP(sessionId, selectedId);
      }
      await refresh();
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function refreshTools() {
    if (!selectedId || !selectedStatus?.running || busy) return;
    setBusy(true);
    try {
      await bridge.refreshMCPTools(sessionId, selectedId);
      await refresh();
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="extensions-workspace">
      <header className="extensions-header">
        <div>
          <h1>{labels.title}</h1>
          <p>{labels.subtitle}</p>
        </div>
        <div className="extensions-runtime">
          <span>{labels.currentRuntime}</span>
          <RuntimeIdentity
            runtime={runtime}
            localLabel={labels.localRuntime}
            worktreeLabel={labels.worktreeRuntime}
          />
        </div>
      </header>

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
                    <small>{config.disabled ? labels.disabled : status?.running ? labels.running : labels.stopped}</small>
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
          <section className="mcp-config-section">
            <div className="mcp-section-head">
              <div>
                <strong>{selectedId || labels.addServer}</strong>
                <span>{labels.noAutoStart}</span>
              </div>
              <div>
                {selectedId && (
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
                  <p className="mcp-runtime-error"><strong>{labels.lastError}</strong> {selectedStatus.lastError}</p>
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
    </section>
  );
}
