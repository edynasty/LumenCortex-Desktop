import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bridge } from "../../lib/bridge";
import { coreErrorKey } from "../../lib/core-errors";
import { readComposerPreferences, saveComposerPreferences } from "../composer-preferences";
import { AGENT_LIMITS, builtinAgents, conversationAgents, resolveAgentId, type ComposerAgent } from "../agent-catalog";
import type { AgentCatalog, AgentEntry, AgentImportResult, AgentLimits } from "../../types";

type Options = {
  /** The open thread, whose pinned agent the composer shows. */
  sessionId: string;
  /** The thread's pinned agent (SessionInfo.Agent); empty before its first turn. */
  pinnedAgent?: string;
  /**
   * The thread is a delegated child. Core keeps its pinned agent and ignores the requested one, so
   * the composer shows the pin, never corrects it and never sends it.
   */
  isChild?: boolean;
  /** The open workspace: its agents are part of the catalog, so a switch reads it again. */
  workspace: string;
  /** Called when the user picks another agent: the next turn must not carry an explicit model. */
  onAgentSelected?: () => void;
};

// One shared value: the fallback catalog must keep its identity, or every consumer's memo churns.
const BUILTIN_CATALOG: AgentCatalog = {
  agents: builtinAgents(), limits: AGENT_LIMITS, globalPath: "", globalDigest: "",
};

/**
 * Core's agent catalog and the composer's selection. Loading never blocks the UI: the four
 * built-ins are the initial state, and an unavailable bridge (browser demo, tests) keeps them.
 * Selection is remembered by id; a deleted or delegation-only id falls back to Agent. Opening a
 * thread adopts its pinned agent, and picking another one only changes the selection: the next
 * Start sends the agent alone, so Core re-pins the model to that agent's first model.
 *
 * The catalog is read again after any global-config write (the page calls reload), when the
 * workspace changes, and after a Save or Delete conflict, so the digest a write carries is the
 * file's current one. A child thread shows the agent Core pinned for it.
 */
export type AgentCatalogController = {
  /** The merged catalog, built-ins first. */
  agents: AgentEntry[];
  limits: AgentLimits;
  warning?: string;
  /** Why the catalog could not be read; the page shows it instead of the import result. */
  loadError?: string;
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

export function useAgentCatalog({ sessionId, pinnedAgent, isChild, workspace, onAgentSelected }: Options): AgentCatalogController {
  const child = Boolean(isChild);
  const [loaded, setLoaded] = useState<{ workspace: string; catalog: AgentCatalog } | null>(null);
  const [storedId, setStoredId] = useState(() => readComposerPreferences().agentId);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Only the newest read is applied: a slow read of the previous workspace must not land.
  const request = useRef(0);
  // The pick callback is read when a pick happens, so a fresh closure from the caller does not
  // change select's identity (and with it the composer's).
  const onSelected = useRef(onAgentSelected);
  useEffect(() => { onSelected.current = onAgentSelected; }, [onAgentSelected]);

  const fetchCatalog = useCallback(async (): Promise<AgentCatalog> => {
    const ticket = ++request.current;
    try {
      const next = await bridge.agents();
      if (ticket === request.current) {
        setLoaded({ workspace, catalog: next });
        setLoadError("");
      }
      return next;
    } catch (failure) {
      if (ticket === request.current) setLoadError(failure instanceof Error ? failure.message : String(failure));
      throw failure;
    } finally {
      if (ticket === request.current) setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    setLoading(true);
    fetchCatalog().catch(() => undefined);
  }, [fetchCatalog]);

  // A catalog belongs to one workspace: until the new read lands, the built-ins stand in, so the
  // previous project's agents are neither shown nor sent.
  const catalog = loaded && loaded.workspace === workspace ? loaded.catalog : BUILTIN_CATALOG;

  // A thread's pinned agent is what the composer shows. It is adopted when the thread opens (or
  // when a turn re-pins it), not on every render: a pick made before the turn runs must survive.
  // Leaving the thread resets the key, so reopening it adopts the pin again.
  const synced = useRef("");
  useEffect(() => {
    if (!sessionId) {
      synced.current = "";
      return;
    }
    if (child || !pinnedAgent) return;
    const key = `${sessionId}:${pinnedAgent}`;
    if (synced.current === key) return;
    synced.current = key;
    setStoredId(pinnedAgent);
    saveComposerPreferences({ agentId: pinnedAgent });
  }, [child, pinnedAgent, sessionId]);

  const agentId = child && pinnedAgent ? pinnedAgent : resolveAgentId(catalog.agents, storedId);
  const agents = useMemo(() => {
    const conversation = conversationAgents(catalog.agents);
    if (!child || !pinnedAgent) return conversation;
    // A child's pin may be delegation-only (Explore); the chip still has to name it.
    const pinned = catalog.agents.find((agent) => agent.id === pinnedAgent);
    return pinned && !pinned.forConversation ? [pinned, ...conversation] : conversation;
  }, [catalog.agents, child, pinnedAgent]);
  const selected = useMemo(
    () => catalog.agents.find((agent) => agent.id === agentId),
    [agentId, catalog.agents],
  );

  // A deleted, renamed or delegation-only id is corrected once the catalog has loaded. A failed
  // load corrects nothing: the built-ins standing in must not erase the remembered custom agent.
  useEffect(() => {
    if (child || loading || loadError || agentId === storedId) return;
    setStoredId(agentId);
    saveComposerPreferences({ agentId });
  }, [agentId, child, loadError, loading, storedId]);

  const select = useCallback((id: string) => {
    const next = resolveAgentId(catalog.agents, id);
    setStoredId(next);
    saveComposerPreferences({ agentId: next });
    // No model is sent with the switch: Core re-pins to the new agent's first model.
    onSelected.current?.();
  }, [catalog.agents]);

  const save = useCallback(async (agent: AgentEntry) => {
    try {
      const next = await bridge.saveAgent(catalog.globalDigest, agent);
      setLoaded({ workspace, catalog: next });
      return next;
    } catch (failure) {
      // The file changed under us. Read it again so the page shows the new content and the next
      // Save carries the current digest, then let the caller show the conflict copy.
      const message = failure instanceof Error ? failure.message : String(failure);
      if (coreErrorKey(message) === "conflict") await fetchCatalog().catch(() => undefined);
      throw failure;
    }
  }, [catalog.globalDigest, fetchCatalog, workspace]);

  const remove = useCallback(async (id: string) => {
    try {
      const next = await bridge.deleteAgent(catalog.globalDigest, id);
      setLoaded({ workspace, catalog: next });
      return next;
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : String(failure);
      if (coreErrorKey(message) === "conflict") await fetchCatalog().catch(() => undefined);
      throw failure;
    }
  }, [catalog.globalDigest, fetchCatalog, workspace]);

  const reload = useCallback(async () => {
    setLoading(true);
    return fetchCatalog();
  }, [fetchCatalog]);

  const composerAgent = useMemo(
    () => ({ agents, selectedId: agentId, onSelect: select, locked: child }),
    [agentId, agents, child, select],
  );

  const importResult: AgentImportResult | undefined = catalog.import;

  return {
    agents: catalog.agents,
    limits: catalog.limits,
    warning: catalog.warning,
    loadError: loadError || undefined,
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
