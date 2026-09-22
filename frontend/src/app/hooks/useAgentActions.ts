import type { Dispatch, FormEvent, SetStateAction } from "react";
import { bridge } from "../../lib/bridge";
import type { AgentConfig, RuntimeKind, Session, WorkflowSummary, WorkspaceState } from "../../types";
import type { WorkspaceRoute } from "../workspace-route";

type Options = {
  selectedSessionId: string;
  currentSession?: Session;
  route: WorkspaceRoute;
  running: boolean;
  busy: boolean;
  workspace: string;
  goal: string;
  contextPaths: string[];
  runtimeKind: RuntimeKind;
  getAgentConfig: () => AgentConfig;
  setWorkspaceState: Dispatch<SetStateAction<WorkspaceState>>;
  setRoute: Dispatch<SetStateAction<WorkspaceRoute>>;
  setGoal: Dispatch<SetStateAction<string>>;
  clearContextPaths: () => void;
  setRuntimeKind: Dispatch<SetStateAction<RuntimeKind>>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setInspectorOpen: Dispatch<SetStateAction<boolean>>;
  refreshCurrent: (sessionId?: string) => Promise<void>;
  resetSessionRuntime: () => void;
  replaceWorkflowSummary: (summary: WorkflowSummary | null) => void;
};

export function useAgentActions({
  selectedSessionId,
  currentSession,
  route,
  running,
  busy,
  workspace,
  goal,
  contextPaths,
  runtimeKind,
  getAgentConfig,
  setWorkspaceState,
  setRoute,
  setGoal,
  clearContextPaths,
  setRuntimeKind,
  setBusy,
  setError,
  setInspectorOpen,
  refreshCurrent,
  resetSessionRuntime,
  replaceWorkflowSummary,
}: Options) {
  async function startAgent(sessionId = selectedSessionId) {
    if (!sessionId || busy) return;
    setBusy(true);
    setError("");
    try {
      const session = await bridge.startAgent(sessionId, getAgentConfig());
      const nextState = await bridge.state();
      setWorkspaceState({
        ...nextState,
        sessions: nextState.sessions.map((item) => item.id === session.id ? session : item),
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const task = goal.trim();
    if (!task || !workspace || busy) return;

    if (route.kind === "thread" && currentSession) {
      if (running) return;
      setBusy(true);
      setError("");
      try {
        await bridge.continueAgent(currentSession.id, task, getAgentConfig());
        setGoal("");
        setWorkspaceState(await bridge.state());
        await refreshCurrent(currentSession.id);
      } catch (err) {
        setError(String(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    setError("");
    try {
      const session = await bridge.createSessionWithRuntime(task, contextPaths, runtimeKind, "HEAD");
      setWorkspaceState((current) => ({
        ...current,
        sessions: [session, ...current.sessions.filter((item) => item.id !== session.id)],
      }));
      setRoute({ kind: "thread", sessionId: session.id });
      resetSessionRuntime();
      setGoal("");
      clearContextPaths();
      setRuntimeKind("local");

      try {
        const started = await bridge.startAgent(session.id, getAgentConfig());
        const nextState = await bridge.state();
        setWorkspaceState({
          ...nextState,
          sessions: nextState.sessions.map((item) => item.id === started.id ? started : item),
        });
      } catch (err) {
        setError(String(err));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function cancelAgent() {
    if (!selectedSessionId || busy) return;
    setBusy(true);
    setError("");
    try {
      await bridge.cancelAgent(selectedSessionId);
      setWorkspaceState(await bridge.state());
      await refreshCurrent(selectedSessionId);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function approveGate(gateId: string) {
    if (!selectedSessionId || busy) return;
    setBusy(true);
    setError("");
    try {
      const summary = await bridge.approveWorkflowGate(selectedSessionId, gateId);
      replaceWorkflowSummary(summary);
      await refreshCurrent(selectedSessionId);

      const stillWaiting = (summary.pendingGates || []).some((gate) => gate.type === "human");
      if (!stillWaiting) {
        await bridge.startAgent(selectedSessionId, getAgentConfig());
      }
      setWorkspaceState(await bridge.state());
      await refreshCurrent(selectedSessionId);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function retryCurrent() {
    if (!currentSession || running || busy) return;
    setBusy(true);
    setError("");
    try {
      await bridge.continueAgent(
        currentSession.id,
        "Retry the previous incomplete attempt. Re-read the durable thread context, identify why the previous run stopped or failed, continue from the current workspace state, and verify the result.",
        getAgentConfig(),
      );
      setWorkspaceState(await bridge.state());
      await refreshCurrent(currentSession.id);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendReviewInstruction(path: string, instruction: string) {
    if (!currentSession || running || busy) return;
    setBusy(true);
    setError("");
    try {
      const prompt = [
        `Review feedback for ${path}:`,
        instruction,
        "",
        "Address this feedback in the current task, inspect the relevant code before editing, and verify the resulting change.",
      ].join("\n");
      await bridge.continueAgent(currentSession.id, prompt, getAgentConfig());
      setWorkspaceState(await bridge.state());
      setRoute({ kind: "thread", sessionId: currentSession.id });
      setInspectorOpen(false);
      await refreshCurrent(currentSession.id);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return {
    startAgent,
    submitTask,
    cancelAgent,
    approveGate,
    retryCurrent,
    sendReviewInstruction,
  };
}
