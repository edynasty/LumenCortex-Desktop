import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionMaintenanceActions } from "./useSessionMaintenanceActions";

const mocks = vi.hoisted(() => ({
  runShell: vi.fn(),
  state: vi.fn(),
  updateSessionUI: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({
  bridge: mocks,
}));

const session = {
  id: "session-1",
  createdAt: "2026-09-22T03:00:00Z",
  updatedAt: "2026-09-22T03:00:00Z",
  status: "completed",
  goal: "task",
};

function setup(overrides: Partial<Parameters<typeof useSessionMaintenanceActions>[0]> = {}) {
  const setWorkspaceState = vi.fn();
  const setRoute = vi.fn();
  const setBusy = vi.fn();
  const setError = vi.fn();
  const setWorktreeCleanupTarget = vi.fn();
  const refreshCurrent = vi.fn().mockResolvedValue(undefined);
  const resetSessionRuntime = vi.fn();

  const options: Parameters<typeof useSessionMaintenanceActions>[0] = {
    selectedSessionId: "session-1",
    busy: false,
    command: " git status --short ",
    setWorkspaceState,
    setRoute,
    setBusy,
    setError,
    setWorktreeCleanupTarget,
    refreshCurrent,
    resetSessionRuntime,
    ...overrides,
  };
  const hook = renderHook(() => useSessionMaintenanceActions(options));
  return {
    ...hook,
    spies: {
      setWorkspaceState,
      setRoute,
      setBusy,
      setError,
      setWorktreeCleanupTarget,
      refreshCurrent,
      resetSessionRuntime,
    },
  };
}

describe("useSessionMaintenanceActions", () => {
  beforeEach(() => {
    for (const fn of Object.values(mocks)) fn.mockReset();
    mocks.state.mockResolvedValue({
      workspace: "/repo",
      sessions: [session],
      activeRuns: [],
    });
  });

  it("runs a trimmed shell command and refreshes the current thread", async () => {
    mocks.runShell.mockResolvedValue({ exitCode: 0 });
    const { result, spies } = setup();

    await act(async () => {
      await result.current.runShell({ preventDefault: vi.fn() } as any);
    });

    expect(mocks.runShell).toHaveBeenCalledWith("session-1", "git status --short");
    expect(spies.refreshCurrent).toHaveBeenCalledWith("session-1");
    expect(spies.setBusy).toHaveBeenNthCalledWith(1, true);
    expect(spies.setBusy).toHaveBeenLastCalledWith(false);
  });

  it("leaves the thread when its session was deleted, directly or as a subagent", async () => {
    const { result, spies } = setup();

    await act(async () => {
      await result.current.completeWorktreeCleanup(["parent-1", "session-1"]);
    });

    expect(spies.setWorktreeCleanupTarget).toHaveBeenCalledWith(null);
    expect(spies.setRoute).toHaveBeenCalledWith({ kind: "new-task" });
    expect(spies.resetSessionRuntime).toHaveBeenCalled();
    expect(spies.setWorkspaceState).toHaveBeenCalledWith(expect.objectContaining({ workspace: "/repo" }));
  });

  it("stays on the thread after its worktree was removed", async () => {
    const { result, spies } = setup();

    await act(async () => {
      await result.current.completeWorktreeCleanup([]);
    });

    expect(spies.setRoute).not.toHaveBeenCalled();
    expect(spies.resetSessionRuntime).not.toHaveBeenCalled();
    expect(spies.setWorkspaceState).toHaveBeenCalledWith(expect.objectContaining({ workspace: "/repo" }));
  });

  it("archives the selected thread and resets thread runtime state", async () => {
    mocks.updateSessionUI.mockResolvedValue({ ...session, archived: true });
    const { result, spies } = setup();

    await act(async () => {
      await result.current.updateSessionUI("session-1", { archived: true });
    });

    expect(spies.setRoute).toHaveBeenCalledWith({ kind: "new-task" });
    expect(spies.resetSessionRuntime).toHaveBeenCalled();
  });
});
