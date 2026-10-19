import { useCallback, useEffect, useMemo, useState } from "react";
import { bridge } from "../../lib/bridge";
import { readComposerPreferences, saveComposerPreferences } from "../composer-preferences";
import { builtinAgentProfiles, resolveAgentId } from "../agent-profiles";
import type { AgentEffort, AgentProfile, AgentProfilesState } from "../../types";
import type { AgentPolicy } from "../agent-config";

type Options = {
  /** Adopt a profile's default model when the user picks it; the choice stays changeable. */
  onModel?: (ref: string) => void;
  onEffort?: (effort: AgentEffort | undefined) => void;
  onPolicy?: (policy: AgentPolicy) => void;
};

/**
 * The agent catalog and the composer's selection. Loading never blocks the UI: the built-ins are
 * the initial state, and an unavailable bridge (browser demo, tests) simply keeps them. Selection is
 * remembered by id; a deleted or unknown id falls back to the Agent built-in. A profile's defaults
 * are adopted only when the user picks it, so a remembered model/effort is not silently replaced on
 * startup.
 */
export type AgentProfilesController = ReturnType<typeof useAgentProfiles>;

export function useAgentProfiles({ onModel, onEffort, onPolicy }: Options) {
  const [state, setState] = useState<AgentProfilesState>(() => ({ profiles: builtinAgentProfiles() }));
  const [storedId, setStoredId] = useState(() => readComposerPreferences().agentId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    bridge.listAgentProfiles().then(
      (next) => {
        if (!cancelled) setState(next);
      },
      () => {
        // The built-ins stay: the composer must work even before Core is reachable.
      },
    ).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const agentId = resolveAgentId(state.profiles, storedId);
  const selected = useMemo(
    () => state.profiles.find((profile) => profile.id === agentId),
    [agentId, state.profiles],
  );

  // A deleted or unknown id is corrected once the catalog has loaded, and the fallback persisted.
  useEffect(() => {
    if (loading || agentId === storedId) return;
    setStoredId(agentId);
    saveComposerPreferences({ agentId, mode: agentId === "ask" ? "ask" : "agent" });
  }, [agentId, loading, storedId]);

  const select = useCallback((id: string) => {
    const next = resolveAgentId(state.profiles, id);
    setStoredId(next);
    const profile = state.profiles.find((item) => item.id === next);
    saveComposerPreferences({ agentId: next, mode: profile?.base === "ask" ? "ask" : "agent" });
    if (profile?.modelRef) onModel?.(profile.modelRef);
    if (profile?.effort) onEffort?.(profile.effort);
    if (profile?.policy) onPolicy?.(profile.policy);
  }, [onEffort, onModel, onPolicy, state.profiles]);

  const save = useCallback(async (profile: AgentProfile) => {
    const next = await bridge.saveAgentProfile(profile);
    setState(next);
    return next;
  }, []);

  const remove = useCallback(async (id: string) => {
    const next = await bridge.deleteAgentProfile(id);
    setState(next);
    return next;
  }, []);

  const reset = useCallback(async (id: string) => {
    const next = await bridge.resetAgentProfile(id);
    setState(next);
    return next;
  }, []);

  const composerAgent = useMemo(
    () => ({ profiles: state.profiles, selectedId: agentId, onSelect: select }),
    [agentId, select, state.profiles],
  );

  return {
    profiles: state.profiles,
    warning: state.warning,
    loading,
    agentId,
    selected,
    select,
    composerAgent,
    save,
    remove,
    reset,
  };
}
