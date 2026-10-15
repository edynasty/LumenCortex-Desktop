import type { Dispatch, FormEvent, SetStateAction } from "react";
import { bridge } from "../../lib/bridge";
import type { WorkspaceState } from "../../types";
import type { WorktreeCleanupTarget } from "../../components/worktree/WorktreeCleanupDialog";
import type { WorkspaceRoute } from "../workspace-route";

type SessionUIPatch = {
  title?: string;
  pinned?: boolean;
  archived?: boolean;
};

type Options = {
  selectedSessionId: string;
  busy: boolean;
  command: string;
  setWorkspaceState: Dispatch<SetStateAction<WorkspaceState>>;
  setRoute: Dispatch<SetStateAction<WorkspaceRoute>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setWorktreeCleanupTarget: Dispatch<SetStateAction<WorktreeCleanupTarget | null>>;
  refreshCurrent: (sessionId?: string) => Promise<void>;
  resetSessionRuntime: () => void;
};

export function useSessionMaintenanceActions({
  selectedSessionId,
  busy,
  command,
  setWorkspaceState,
  setRoute,
  setBusy,
  setError,
  setWorktreeCleanupTarget,
  refreshCurrent,
  resetSessionRuntime,
}: Options) {
  async function runShell(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSessionId || !command.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await bridge.runShell(selectedSessionId, command.trim());
      await refreshCurrent(selectedSessionId);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  // Core removed the worktree or deleted the session (and its finished subagents).
  // The session list and every runtime binding are reloaded from Core.
  async function completeWorktreeCleanup(deletedSessionIds: string[]) {
    setWorktreeCleanupTarget(null);
    if (deletedSessionIds.includes(selectedSessionId)) {
      setRoute({ kind: "new-task" });
      resetSessionRuntime();
    }
    try {
      setWorkspaceState(await bridge.state());
    } catch (err) {
      setError(String(err));
    }
  }

  async function updateSessionUI(sessionId: string, patch: SessionUIPatch) {
    setError("");
    try {
      const updated = await bridge.updateSessionUI(sessionId, patch);
      setWorkspaceState((current) => ({
        ...current,
        sessions: current.sessions.map((session) => session.id === updated.id ? updated : session),
      }));
      if (patch.archived === true && selectedSessionId === sessionId) {
        setRoute({ kind: "new-task" });
        resetSessionRuntime();
      }
    } catch (err) {
      setError(String(err));
    }
  }

  return {
    runShell,
    completeWorktreeCleanup,
    updateSessionUI,
  };
}
