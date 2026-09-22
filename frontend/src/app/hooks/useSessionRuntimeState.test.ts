import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionRuntimeState } from "./useSessionRuntimeState";

const mocks = vi.hoisted(() => ({
  messagePage: vi.fn(),
  workflowSummary: vi.fn(),
  subagentTree: vi.fn(),
  sessionCheckpoints: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({
  bridge: mocks,
}));

const page = {
  messages: [{ sessionId: "session-1", seq: 4, role: "assistant", json: { content: "ready" } }],
};

describe("useSessionRuntimeState", () => {
  beforeEach(() => {
    for (const fn of Object.values(mocks)) fn.mockReset();
    mocks.messagePage.mockResolvedValue(page);
    mocks.workflowSummary.mockResolvedValue({ currentAction: "verify" });
    mocks.subagentTree.mockResolvedValue([]);
    mocks.sessionCheckpoints.mockResolvedValue([]);
    mocks.getSession.mockResolvedValue({
      id: "session-1",
      status: "running",
      goal: "test",
    });
  });

  it("loads bounded runtime state for the selected session", async () => {
    const setWorkspaceState = vi.fn();
    const setError = vi.fn();
    const { result } = renderHook(() => useSessionRuntimeState({
      selectedSessionId: "session-1",
      setWorkspaceState,
      setError,
    }));

    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    expect(mocks.messagePage).toHaveBeenCalledWith("session-1", -1, 100);
    expect(mocks.workflowSummary).toHaveBeenCalledWith("session-1");
    expect(mocks.subagentTree).toHaveBeenCalledWith("session-1");
    expect(mocks.sessionCheckpoints).toHaveBeenCalledWith("session-1", 20);
    expect(result.current.atLatest).toBe(true);
  });

  it("refreshes timeline and subagent state from runtime events", async () => {
    const { result } = renderHook(() => useSessionRuntimeState({
      selectedSessionId: "session-1",
      setWorkspaceState: vi.fn(),
      setError: vi.fn(),
    }));

    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    mocks.messagePage.mockClear();
    mocks.workflowSummary.mockClear();
    mocks.subagentTree.mockClear();
    mocks.sessionCheckpoints.mockClear();

    act(() => {
      result.current.handleRuntimeEvent({
        type: "tool.end",
        sessionId: "session-1",
        at: "2026-09-22T03:00:00Z",
        data: {},
      });
      result.current.handleRuntimeEvent({
        type: "subagent.spawned",
        sessionId: "session-1",
        at: "2026-09-22T03:00:01Z",
        data: {},
      });
    });

    await waitFor(() => expect(mocks.messagePage).toHaveBeenCalledWith("session-1", -1, 100));
    await waitFor(() => expect(mocks.subagentTree).toHaveBeenCalledWith("session-1"));
    expect(mocks.workflowSummary).toHaveBeenCalledWith("session-1");
    expect(mocks.sessionCheckpoints).toHaveBeenCalledWith("session-1", 20);
  });
});
