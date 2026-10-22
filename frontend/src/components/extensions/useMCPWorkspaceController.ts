import { useCallback, useEffect, useMemo, useState } from "react";
import { bridge } from "../../lib/bridge";
import { joinCommandArgs, splitCommandArgs } from "../../lib/command-line";
import { coreErrorKey } from "../../lib/core-errors";
import type {
  MCPAgentTool,
  MCPConfig,
  MCPConfigScope,
  MCPDefinedScope,
  MCPProtocolMode,
  MCPStatus,
  MCPToolPermission,
} from "../../types";

type Options = {
  workspace: string;
  sessionId: string;
  /** The open workspace's trust, from the app's one trust source (ConfigState.trusted). */
  trusted: boolean;
  onError: (message: string) => void;
};

/** global | project — the writable config layers (not "effective"). */
export type MCPEditScope = MCPDefinedScope;

/** The MCP pane's controller: scope, layered configs, draft, runtime state and actions. */
export type MCPWorkspaceController = {
  configs: MCPConfig[];
  projectConfigs: MCPConfig[];
  scope: MCPEditScope;
  setScope: (next: MCPEditScope) => void;
  tools: MCPAgentTool[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  draft: MCPConfig;
  setDraft: (updater: (current: MCPConfig) => MCPConfig) => void;
  argsText: string;
  setArgsText: (value: string) => void;
  busy: boolean;
  deleteOpen: boolean;
  setDeleteOpen: (open: boolean) => void;
  selectedScopedConfig: MCPConfig | undefined;
  inherited: boolean;
  statusById: Map<string, MCPStatus>;
  selectedStatus: MCPStatus | undefined;
  selectedTools: MCPAgentTool[];
  /** The file the selected entry is defined in; undefined while nothing is selected. */
  selectedScope: MCPDefinedScope | undefined;
  /** The selected entry belongs to the project file of an untrusted workspace (ADR-0013). */
  selectedBlocked: boolean;
  /** Core refused a start for trust after the pane had rendered (a race); cleared on the next action. */
  startRefused: boolean;
  clearStartRefused: () => void;
  beginNew: () => void;
  saveConfig: () => Promise<void>;
  deleteConfig: () => Promise<void>;
  toggleServer: () => Promise<void>;
  refreshTools: () => Promise<void>;
  /** Writes the permission override into the file the selected entry came from; null clears it. */
  setToolPermission: (toolName: string, permission: MCPToolPermission | null) => Promise<void>;
};

const emptyConfig = (): MCPConfig => ({
  id: "",
  name: "",
  command: "",
  args: [],
  protocolMode: "legacy",
  disabled: false,
});

/** Where a listed entry is defined: Core's scope, or membership in the project layer. */
function definedScope(config: MCPConfig | undefined, projectConfigs: MCPConfig[]): MCPDefinedScope | undefined {
  if (!config) return undefined;
  if (config.scope) return config.scope;
  return projectConfigs.some((item) => item.id === config.id) ? "project" : "global";
}

export function useMCPWorkspaceController({ workspace, sessionId, trusted, onError }: Options): MCPWorkspaceController {
  const [configs, setConfigs] = useState<MCPConfig[]>([]);
  const [globalConfigs, setGlobalConfigs] = useState<MCPConfig[]>([]);
  const [projectConfigs, setProjectConfigs] = useState<MCPConfig[]>([]);
  const [scope, setScope] = useState<Exclude<MCPConfigScope, "effective">>("project");
  const [statuses, setStatuses] = useState<MCPStatus[]>([]);
  const [tools, setTools] = useState<MCPAgentTool[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<MCPConfig>(emptyConfig);
  const [argsText, setArgsText] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [startRefused, setStartRefused] = useState(false);

  // Trust is a dependency: listing and tool exposure both change when the user trusts the workspace.
  const refresh = useCallback(async () => {
    if (!workspace) {
      setConfigs([]);
      setGlobalConfigs([]);
      setProjectConfigs([]);
      setStatuses([]);
      setTools([]);
      return;
    }
    try {
      const [nextConfigs, nextGlobal, nextProject, nextStatuses, nextTools] = await Promise.all([
        bridge.mcpConfigsScope("effective"),
        bridge.mcpConfigsScope("global"),
        bridge.mcpConfigsScope("project"),
        bridge.mcpStatuses(sessionId),
        bridge.mcpTools(sessionId),
      ]);
      setConfigs(nextConfigs);
      setGlobalConfigs(nextGlobal);
      setProjectConfigs(nextProject);
      setStatuses(nextStatuses);
      setTools(nextTools);
      setSelectedId((current) => {
        if (current && nextConfigs.some((config) => config.id === current)) return current;
        return nextConfigs[0]?.id || "";
      });
    } catch (err) {
      onError(String(err));
    }
  }, [onError, sessionId, trusted, workspace]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The trust notice is a statement about the current selection and trust state, so a start refusal
  // from an earlier state must not outlive either.
  useEffect(() => {
    setStartRefused(false);
  }, [selectedId, trusted]);

  const scopeConfigs = scope === "global" ? globalConfigs : projectConfigs;
  const selectedEffectiveConfig = configs.find((item) => item.id === selectedId);
  const selectedScopedConfig = scopeConfigs.find((item) => item.id === selectedId);
  const inherited = Boolean(selectedId && selectedEffectiveConfig && !selectedScopedConfig);

  useEffect(() => {
    const config = selectedScopedConfig || selectedEffectiveConfig;
    if (!config) {
      setDraft(emptyConfig());
      setArgsText("");
      return;
    }
    setDraft({ ...config, args: [...(config.args || [])], tools: { ...(config.tools || {}) } });
    setArgsText(joinCommandArgs(config.args));
  }, [selectedEffectiveConfig, selectedScopedConfig, scope]);

  const statusById = useMemo(
    () => new Map(statuses.map((status) => [status.id, status])),
    [statuses],
  );
  const selectedStatus = selectedId ? statusById.get(selectedId) : undefined;
  const selectedTools = useMemo(
    () => tools.filter((tool) => tool.serverId === selectedId),
    [selectedId, tools],
  );
  const selectedScope = definedScope(selectedEffectiveConfig, projectConfigs);
  // Core lists a project-only entry as blocked instead of hiding it, so the reason stays visible.
  const selectedBlocked = Boolean(
    selectedEffectiveConfig?.blockedByTrust || (selectedScope === "project" && !trusted),
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
      await bridge.saveMCPConfigScope(scope, {
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
      await bridge.deleteMCPConfigScope(scope, selectedId);
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
    // A blocked project server cannot be started, but one that is still running can be stopped.
    if (!selectedId || busy || (selectedBlocked && !selectedStatus?.running)) return;
    setBusy(true);
    setStartRefused(false);
    try {
      if (selectedStatus?.running) {
        await bridge.stopMCP(sessionId, selectedId);
      } else {
        await bridge.startMCP(sessionId, selectedId);
      }
      await refresh();
    } catch (err) {
      // Core refuses a project server of an untrusted workspace with ErrUntrustedWorkspace. The pane
      // shows its own trust notice for that refusal instead of a raw error (the trust state can be
      // withdrawn between the render and the click).
      if (coreErrorKey(String(err)) === "untrustedWorkspace") {
        setStartRefused(true);
        await refresh();
      } else {
        onError(String(err));
      }
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

  // The override goes through the ordinary config save into LC's own mcp.json of the file the entry
  // came from; Core decides whether it takes effect (a project override needs a trusted workspace).
  async function setToolPermission(toolName: string, permission: MCPToolPermission | null) {
    if (!selectedId || !selectedScope || busy) return;
    const entry = (selectedScope === "global" ? globalConfigs : projectConfigs)
      .find((item) => item.id === selectedId) || selectedEffectiveConfig;
    if (!entry) return;
    const nextTools = { ...(entry.tools || {}) };
    if (permission) nextTools[toolName] = { permission };
    else delete nextTools[toolName];
    const { scope: _scope, blockedByTrust: _blocked, ...rest } = entry;
    setBusy(true);
    try {
      await bridge.saveMCPConfigScope(selectedScope, {
        ...rest,
        tools: Object.keys(nextTools).length ? nextTools : undefined,
      });
      await refresh();
    } catch (err) {
      onError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return {
    configs,
    projectConfigs,
    scope,
    setScope,
    tools,
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
    clearStartRefused: () => setStartRefused(false),
    beginNew,
    saveConfig,
    deleteConfig,
    toggleServer,
    refreshTools,
    setToolPermission,
  };
}
