import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAgentActions } from "./useAgentActions";

const mocks = vi.hoisted(() => ({
  startAgent: vi.fn(),
  state: vi.fn(),
  continueAgent: vi.fn(),
  createSessionWithRuntime: vi.fn(),
  cancelAgent: vi.fn(),
  approveWorkflowGate: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({
  bridge: mocks,
}));

const baseSession = {
  id: "session-1",
  createdAt: "2026-09-22T03:00:00Z",
  updatedAt: "2026-09-22T03:00:00Z",
  status: "created",
  goal: "task",
};

function renderActions(overrides: Partial<Parameters<typeof useAgentActions>[0]> = {}) {
  const setWorkspaceState = vi.fn();
  const setRoute = vi.fn();
  const setGoal = vi.fn();
  const clearContextPaths = vi.fn();
  const setRuntimeKind = vi.fn();
  const setBusy = vi.fn();
  const setError = vi.fn();
  const setInspectorOpen = vi.fn();
  const refreshCurrent = vi.fn().mockResolvedValue(undefined);
  const resetSessionRuntime = vi.fn();
  const replaceWorkflowSummary = vi.fn();

  const options: Parameters<typeof useAgentActions>[0] = {
    selectedSessionId: "session-1",
    currentSession: baseSession,
    route: { kind: "thread", sessionId: "session-1" },
    running: false,
    busy: false,
    workspace: "/repo",
    goal: "continue task",
    contextPaths: ["src"],
    runtimeKind: "local",
    getAgentConfig: () => ({
      provider: {},
      modelRef: "demo/model",
      policy: "workspace",
      maxSteps: 24,
    }),
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
    ...overrides,
  };

  const hook = renderHook(() => useAgentActions(options));
  return {
    ...hook,
    spies: {
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
    },
  };
}

describe("useAgentActions", () => {
  beforeEach(() => {
    for (const fn of Object.values(mocks)) fn.mockReset();
    mocks.state.mockResolvedValue({
      workspace: "/repo",
      sessions: [baseSession],
      activeRuns: [],
    });
  });

  it("continues the current thread with the composed agent config", async () => {
    mocks.continueAgent.mockResolvedValue(undefined);
    const { result, spies } = renderActions();

    await act(async () => {
      await result.current.submitTask({ preventDefault: vi.fn() } as any);
    });

    expect(mocks.continueAgent).toHaveBeenCalledWith(
      "session-1",
      "continue task",
      expect.objectContaining({
        modelRef: "demo/model",
        policy: "workspace",
      }),
    );
    expect(spies.setGoal).toHaveBeenCalledWith("");
    expect(spies.refreshCurrent).toHaveBeenCalledWith("session-1");
    expect(spies.setBusy).toHaveBeenNthCalledWith(1, true);
    expect(spies.setBusy).toHaveBeenLastCalledWith(false);
  });

  it("creates a new runtime session, resets composer state, then starts the agent", async () => {
    const created = { ...baseSession, id: "session-new", goal: "new task" };
    const started = { ...created, status: "running" };
    mocks.createSessionWithRuntime.mockResolvedValue(created);
    mocks.startAgent.mockResolvedValue(started);
    mocks.state.mockResolvedValue({
      workspace: "/repo",
      sessions: [started],
      activeRuns: [{ sessionId: started.id }],
    });

    const { result, spies } = renderActions({
      route: { kind: "new-task" },
      currentSession: undefined,
      goal: "new task",
      runtimeKind: "worktree",
    });

    await act(async () => {
      await result.current.submitTask({ preventDefault: vi.fn() } as any);
    });

    expect(mocks.createSessionWithRuntime).toHaveBeenCalledWith(
      "new task",
      ["src"],
      "worktree",
      "HEAD",
    );
    expect(spies.setRoute).toHaveBeenCalledWith({ kind: "thread", sessionId: "session-new" });
    expect(spies.resetSessionRuntime).toHaveBeenCalled();
    expect(spies.clearContextPaths).toHaveBeenCalled();
    expect(spies.setRuntimeKind).toHaveBeenCalledWith("local");
    expect(mocks.startAgent).toHaveBeenCalledWith("session-new", expect.any(Object));
  });

  it("approves a gate and resumes only when no human gate remains", async () => {
    mocks.approveWorkflowGate.mockResolvedValue({
      pendingGates: [],
    });
    mocks.startAgent.mockResolvedValue({ ...baseSession, status: "running" });
    const { result, spies } = renderActions();

    await act(async () => {
      await result.current.approveGate("gate-1");
    });

    expect(spies.replaceWorkflowSummary).toHaveBeenCalledWith({ pendingGates: [] });
    expect(mocks.startAgent).toHaveBeenCalledWith("session-1", expect.any(Object));
    expect(spies.refreshCurrent).toHaveBeenCalledWith("session-1");
  });
});
