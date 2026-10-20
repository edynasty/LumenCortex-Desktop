import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bridge } from "../../lib/bridge";
import { readComposerPreferences, saveComposerPreferences } from "../composer-preferences";
import { AGENT_LIMITS, builtinAgents, conversationAgents, resolveAgentId, type ComposerAgent } from "../agent-catalog";
import type { AgentCatalog, AgentEntry, AgentImportResult, AgentLimits } from "../../types";

type Options = {
  /** The open thread, whose pinned agent the composer shows. */
  sessionId: string;
  /** The thread's pinned agent (SessionInfo.Agent); empty before its first turn. */
  pinnedAgent?: string;
  /** Called when the user picks another agent: the next turn must not carry an explicit model. */
  onAgentSelected?: () => void;
};

const EMPTY_LIMITS: AgentLimits = AGENT_LIMITS;

function emptyCatalog(): AgentCatalog {
  return { agents: builtinAgents(), limits: EMPTY_LIMITS, globalPath: "", globalDigest: "" };
}

/**
 * Core's agent catalog and the composer's selection. Loading never blocks the UI: the four
 * built-ins are the initial state, and an unavailable bridge (browser demo, tests) keeps them.
 * Selection is remembered by id; a deleted or delegation-only id falls back to Agent. Opening a
 * thread adopts its pinned agent, and picking another one only changes the selection: the next
 * Start sends the agent alone, so Core re-pins the model to that agent's first model.
 */
export type AgentCatalogController = {
  /** The merged catalog, built-ins first. */
  agents: AgentEntry[];
  limits: AgentLimits;
  warning?: string;
  importResult?: AgentImportResult;
  loading: boolean;
  /** The selection: the thread's pinned agent, else the remembered one, else Agent. */
  agentId: string;
  selected?: AgentEntry;
  select: (id: string) => void;
  composerAgent: ComposerAgent;
  save: (agent: AgentEntry) => Promise<AgentCatalog>;
  remove: (id: string) => Promise<AgentCatalog>;
  reload: () => Promise<AgentCatalog>;
};

export function useAgentCatalog({ sessionId, pinnedAgent, onAgentSelected }: Options): AgentCatalogController {
  const [catalog, setCatalog] = useState<AgentCatalog>(emptyCatalog);
  const [storedId, setStoredId] = useState(() => readComposerPreferences().agentId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    bridge.agents().then(
      (next) => {
        if (!cancelled) setCatalog(next);
      },
      () => {
        // The built-ins stay: the composer must work even before Core is reachable.
      },
    ).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // A thread's pinned agent is what the composer shows. It is adopted when the thread opens (or
  // when a turn re-pins it), not on every render: a pick made before the turn runs must survive.
  const synced = useRef("");
  useEffect(() => {
    if (!sessionId || !pinnedAgent) return;
    const key = `${sessionId}:${pinnedAgent}`;
    if (synced.current === key) return;
    synced.current = key;
    setStoredId(pinnedAgent);
    saveComposerPreferences({ agentId: pinnedAgent });
  }, [pinnedAgent, sessionId]);

  const agentId = resolveAgentId(catalog.agents, storedId);
  const agents = useMemo(() => conversationAgents(catalog.agents), [catalog.agents]);
  const selected = useMemo(
    () => catalog.agents.find((agent) => agent.id === agentId),
    [agentId, catalog.agents],
  );

  // A deleted, renamed or delegation-only id is corrected once the catalog has loaded.
  useEffect(() => {
    if (loading || agentId === storedId) return;
    setStoredId(agentId);
    saveComposerPreferences({ agentId });
  }, [agentId, loading, storedId]);

  const select = useCallback((id: string) => {
    const next = resolveAgentId(catalog.agents, id);
    setStoredId(next);
    saveComposerPreferences({ agentId: next });
    // No model is sent with the switch: Core re-pins to the new agent's first model.
    onAgentSelected?.();
  }, [catalog.agents, onAgentSelected]);

  const save = useCallback(async (agent: AgentEntry) => {
    const next = await bridge.saveAgent(catalog.globalDigest, agent);
    setCatalog(next);
    return next;
  }, [catalog.globalDigest]);

  const remove = useCallback(async (id: string) => {
    const next = await bridge.deleteAgent(catalog.globalDigest, id);
    setCatalog(next);
    return next;
  }, [catalog.globalDigest]);

  const reload = useCallback(async () => {
    const next = await bridge.agents();
    setCatalog(next);
    return next;
  }, []);

  const composerAgent = useMemo(
    () => ({ agents, selectedId: agentId, onSelect: select }),
    [agentId, agents, select],
  );

  const importResult: AgentImportResult | undefined = catalog.import;

  return {
    agents: catalog.agents,
    limits: catalog.limits,
    warning: catalog.warning,
    importResult,
    loading,
    agentId,
    selected,
    select,
    composerAgent,
    save,
    remove,
    reload,
  };
}
