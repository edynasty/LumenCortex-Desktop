import { describe, expect, it } from "vitest";
import type { WorktreeInspection } from "../types";
import { worktreeCleanupChoices } from "./worktree-cleanup";

const owner: WorktreeInspection = {
  sessionId: "s1",
  role: "owner",
  path: "/repo/.lumencortex-worktrees/s1",
  branch: "lumencortex/s1",
  exists: true,
  registered: true,
  branchExists: true,
  head: "abc123",
  statusDigest: "sha256:d1",
};

const kinds = (inspection: WorktreeInspection, mode: "remove" | "delete" = "remove") =>
  worktreeCleanupChoices(inspection, mode).map((choice) => choice.kind);

describe("worktreeCleanupChoices", () => {
  it("offers only the safe default when nothing would be lost", () => {
    expect(worktreeCleanupChoices(owner, "remove")).toEqual([{ kind: "default", cleanup: {} }]);
  });

  it("never offers the default or keep-branch over uncommitted changes", () => {
    expect(kinds({ ...owner, dirtyFiles: ["draft.txt"] })).toEqual(["discard"]);
    expect(kinds({ ...owner, dirtyFiles: ["draft.txt"], unappliedCommits: ["c1"] })).toEqual(["discard"]);
  });

  it("offers keep-branch before discard for unapplied commits or ignored files", () => {
    expect(kinds({ ...owner, unappliedCommits: ["c1"] })).toEqual(["keepBranch", "discard"]);
    expect(kinds({ ...owner, ignoredFiles: [".env"] })).toEqual(["keepBranch", "discard"]);
  });

  it("binds a discard to the inspected HEAD and status digest", () => {
    const discard = worktreeCleanupChoices({ ...owner, dirtyFiles: ["draft.txt"] }, "remove")[0];
    expect(discard.cleanup).toEqual({ discard: { expectHead: "abc123", expectStatusDigest: "sha256:d1" } });
  });

  it("does not offer a discard it cannot bind to a HEAD", () => {
    expect(kinds({ ...owner, head: undefined, unappliedCommits: ["c1"] })).toEqual(["keepBranch"]);
  });

  it("lets a borrower only unbind and an uncertain binding only be retained", () => {
    expect(kinds({ ...owner, role: "borrower", dirtyFiles: ["x"] })).toEqual(["default"]);
    expect(worktreeCleanupChoices({ ...owner, role: "uncertain", uncertain: "branch switched" }, "remove"))
      .toEqual([{ kind: "keepBranch", cleanup: { keepBranch: true } }]);
  });

  it("deletes a session without a worktree but has nothing to remove", () => {
    const local: WorktreeInspection = { sessionId: "s2", exists: false, registered: false, branchExists: false };
    expect(kinds(local, "delete")).toEqual(["default"]);
    expect(kinds(local, "remove")).toEqual([]);
  });
});
