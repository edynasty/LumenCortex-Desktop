import { useCallback, useEffect, useMemo, useState } from "react";
import { bridge } from "../../lib/bridge";
import { joinCommandArgs, splitCommandArgs } from "../../lib/command-line";
import type {
  MCPAgentTool,
  MCPConfig,
  MCPConfigScope,
  MCPProtocolMode,
  MCPStatus,
} from "../../types";

type Options = {
  workspace: string;
  sessionId: string;
  onError: (message: string) => void;
};

/** global | project — the writable config layers (not "effective"). */
export type MCPEditScope = Exclude<MCPConfigScope, "effective">;

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
  beginNew: () => void;
  saveConfig: () => Promise<void>;
  deleteConfig: () => Promise<void>;
  toggleServer: () => Promise<void>;
  refreshTools: () => Promise<void>;
};

const emptyConfig = (): MCPConfig => ({
  id: "",
  name: "",
  command: "",
  args: [],
  protocolMode: "legacy",
  disabled: false,
});

export function useMCPWorkspaceController({ workspace, sessionId, onError }: Options): MCPWorkspaceController {
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
  }, [onError, sessionId, workspace]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    setDraft({ ...config, args: [...(config.args || [])] });
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
    beginNew,
    saveConfig,
    deleteConfig,
    toggleServer,
    refreshTools,
  };
}
