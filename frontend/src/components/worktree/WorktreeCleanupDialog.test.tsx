import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../../lib/i18n/app-copy";
import type { WorktreeInspection } from "../../types";
import { WorktreeCleanupDialog } from "./WorktreeCleanupDialog";

const mocks = vi.hoisted(() => ({
  inspectSessionWorktree: vi.fn(),
  removeSessionWorktree: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock("../../lib/bridge", () => ({ bridge: mocks }));

const labels = copy.en;

const dirty: WorktreeInspection = {
  sessionId: "s1",
  role: "owner",
  path: "/repo/.lumencortex-worktrees/s1",
  branch: "lumencortex/s1",
  exists: true,
  registered: true,
  branchExists: true,
  head: "head-1",
  statusDigest: "digest-1",
  dirtyFiles: ["draft.txt"],
};

describe("WorktreeCleanupDialog", () => {
  beforeEach(() => {
    for (const fn of Object.values(mocks)) fn.mockReset();
  });

  it("shows what would be lost and offers no safe removal over uncommitted changes", async () => {
    mocks.inspectSessionWorktree.mockResolvedValue(dirty);
    render(<WorktreeCleanupDialog target={{ mode: "remove", sessionId: "s1" }} labels={labels} onClose={vi.fn()} onCompleted={vi.fn()} />);

    expect(await screen.findByText("draft.txt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: labels.worktreeRemoveSafe })).toBeNull();
    expect(screen.queryByRole("button", { name: labels.worktreeKeepBranch })).toBeNull();
    expect(screen.getByRole("button", { name: labels.worktreeDiscard })).toBeInTheDocument();
  });

  it("after a stale refusal, shows Core's fresh state and binds the next discard to it", async () => {
    const user = userEvent.setup();
    const fresh: WorktreeInspection = { ...dirty, statusDigest: "digest-2", dirtyFiles: ["draft.txt", "newer.txt"] };
    mocks.inspectSessionWorktree.mockResolvedValue(dirty);
    mocks.removeSessionWorktree
      .mockResolvedValueOnce({ refusal: { code: "stale", message: "changed", inspection: fresh } })
      .mockResolvedValueOnce({ result: { action: "removed", discarded: true } });
    const onCompleted = vi.fn();
    render(<WorktreeCleanupDialog target={{ mode: "remove", sessionId: "s1" }} labels={labels} onClose={vi.fn()} onCompleted={onCompleted} />);

    await user.click(await screen.findByRole("button", { name: labels.worktreeDiscard }));
    expect(mocks.removeSessionWorktree).toHaveBeenLastCalledWith("s1", { discard: { expectHead: "head-1", expectStatusDigest: "digest-1" } });
    expect(await screen.findByText(labels.worktreeRefusalChanged)).toBeInTheDocument();
    expect(screen.getByText("newer.txt")).toBeInTheDocument();
    expect(onCompleted).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: labels.worktreeDiscard }));
    expect(mocks.removeSessionWorktree).toHaveBeenLastCalledWith("s1", { discard: { expectHead: "head-1", expectStatusDigest: "digest-2" } });
    expect(onCompleted).toHaveBeenCalledWith([]);
  });

  it("reports a deletion with the subagents Core deleted, and lists blocking dependents", async () => {
    const user = userEvent.setup();
    mocks.inspectSessionWorktree.mockResolvedValue({ sessionId: "s1", exists: false, registered: false, branchExists: false });
    mocks.deleteSession
      .mockResolvedValueOnce({ refusal: { code: "dependents", message: "", dependents: [{ sessionId: "child-1", kind: "subagent", reason: "running" }] } })
      .mockResolvedValueOnce({ result: { sessionId: "s1", worktree: { action: "none" }, deletedChildren: ["child-1"] } });
    const onCompleted = vi.fn();
    render(<WorktreeCleanupDialog target={{ mode: "delete", sessionId: "s1" }} labels={labels} onClose={vi.fn()} onCompleted={onCompleted} />);

    expect(await screen.findByText(labels.worktreeNone)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: labels.deleteSessionSafe }));
    expect(await screen.findByText("child-1")).toBeInTheDocument();
    expect(screen.getByText(labels.worktreeRefusalDependents)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: labels.deleteSessionSafe }));
    expect(mocks.deleteSession).toHaveBeenLastCalledWith("s1", {});
    expect(onCompleted).toHaveBeenCalledWith(["s1", "child-1"]);
  });
});
