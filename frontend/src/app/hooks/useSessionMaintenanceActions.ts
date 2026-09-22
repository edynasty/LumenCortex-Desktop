import type { Dispatch, FormEvent, SetStateAction } from "react";
import { bridge } from "../../lib/bridge";
import type { RuntimeKind, Session, WorkspaceState } from "../../types";
import type { WorkspaceRoute } from "../workspace-route";

type SessionUIPatch = {
  title?: string;
  pinned?: boolean;
  archived?: boolean;
};

type Options = {
  selectedSessionId: string;
  currentSession?: Session;
  currentRuntimeKind: RuntimeKind;
  running: boolean;
  busy: boolean;
  command: string;
  setWorkspaceState: Dispatch<SetStateAction<WorkspaceState>>;
  setRoute: Dispatch<SetStateAction<WorkspaceRoute>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setCleanupWorktreeOpen: Dispatch<SetStateAction<boolean>>;
  refreshCurrent: (sessionId?: string) => Promise<void>;
  resetSessionRuntime: () => void;
};

export function useSessionMaintenanceActions({
  selectedSessionId,
  currentSession,
  currentRuntimeKind,
  running,
  busy,
  command,
  setWorkspaceState,
  setRoute,
  setBusy,
  setError,
  setCleanupWorktreeOpen,
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

  async function cleanupCurrentWorktree(force: boolean) {
    if (!currentSession || currentRuntimeKind !== "worktree" || running || busy) return;
    setBusy(true);
    setError("");
    try {
      await bridge.removeSessionWorktree(currentSession.id, force);
      setWorkspaceState(await bridge.state());
      setCleanupWorktreeOpen(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
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
    cleanupCurrentWorktree,
    updateSessionUI,
  };
}
