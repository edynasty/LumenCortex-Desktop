import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorktreeHandoff } from "./useWorktreeHandoff";

const mocks = vi.hoisted(() => ({
  worktreeHandoffPlan: vi.fn(),
  applySessionWorktree: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({
  bridge: mocks,
}));

describe("useWorktreeHandoff", () => {
  beforeEach(() => {
    mocks.worktreeHandoffPlan.mockReset();
    mocks.applySessionWorktree.mockReset();
    mocks.worktreeHandoffPlan.mockResolvedValue({
      sessionId: "session-1",
      runtime: { kind: "worktree", path: "/tmp/wt" },
      commits: ["abc123"],
      sourceFiles: ["src/main.ts"],
      targetFiles: [],
      overlappingFiles: [],
      sourceDirty: false,
      targetDirty: false,
      canApply: true,
    });
  });

  it("loads a worktree plan and refreshes after apply", async () => {
    const onAfterApply = vi.fn().mockResolvedValue(undefined);
    mocks.applySessionWorktree.mockResolvedValue({
      action: { output: "applied" },
      targetHead: "def456",
    });

    const { result } = renderHook(() => useWorktreeHandoff({
      sessionId: "session-1",
      runtimeKind: "worktree",
      revision: 1,
      agentRunning: false,
      appliedLabel: "Applied",
      onAfterApply,
    }));

    await waitFor(() => expect(result.current.plan?.canApply).toBe(true));
    expect(mocks.worktreeHandoffPlan).toHaveBeenCalledWith("session-1");

    await act(async () => {
      await result.current.apply();
    });

    expect(mocks.applySessionWorktree).toHaveBeenCalledWith("session-1");
    expect(onAfterApply).toHaveBeenCalledTimes(1);
    expect(result.current.notice).toBe("applied");
    expect(result.current.busy).toBe(false);
    expect(mocks.worktreeHandoffPlan).toHaveBeenCalledTimes(2);
  });

  it("does not query handoff state for a local runtime", async () => {
    const onAfterApply = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useWorktreeHandoff({
      sessionId: "session-2",
      runtimeKind: "local",
      revision: 1,
      agentRunning: false,
      appliedLabel: "Applied",
      onAfterApply,
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.plan).toBeNull();
    expect(mocks.worktreeHandoffPlan).not.toHaveBeenCalled();
    expect(mocks.applySessionWorktree).not.toHaveBeenCalled();
  });

  it("blocks apply while the agent is running", async () => {
    const onAfterApply = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() => useWorktreeHandoff({
      sessionId: "session-3",
      runtimeKind: "worktree",
      revision: 1,
      agentRunning: true,
      appliedLabel: "Applied",
      onAfterApply,
    }));

    await waitFor(() => expect(result.current.plan).not.toBeNull());

    await act(async () => {
      await result.current.apply();
    });

    expect(mocks.applySessionWorktree).not.toHaveBeenCalled();
    expect(onAfterApply).not.toHaveBeenCalled();
  });
});
