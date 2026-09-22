import { useCallback, useEffect, useState } from "react";
import { bridge } from "../../lib/bridge";
import type { RuntimeKind, WorktreeHandoffPlan } from "../../types";

type Options = {
  sessionId: string;
  runtimeKind: RuntimeKind;
  revision: number;
  agentRunning: boolean;
  appliedLabel: string;
  onAfterApply: () => Promise<void>;
};

export function useWorktreeHandoff({
  sessionId,
  runtimeKind,
  revision,
  agentRunning,
  appliedLabel,
  onAfterApply,
}: Options) {
  const [plan, setPlan] = useState<WorktreeHandoffPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (runtimeKind !== "worktree") {
      setPlan(null);
      setError("");
      return;
    }
    setLoading(true);
    try {
      setPlan(await bridge.worktreeHandoffPlan(sessionId));
      setError("");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [runtimeKind, sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh, revision]);

  async function apply() {
    if (runtimeKind !== "worktree" || busy || agentRunning) return;
    setBusy(true);
    setError("");
    try {
      const result = await bridge.applySessionWorktree(sessionId);
      setNotice(result.action.output || result.targetHead || appliedLabel);
      await onAfterApply();
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return {
    plan,
    loading,
    busy,
    notice,
    error,
    refresh,
    apply,
  };
}
