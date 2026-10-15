import type { WorktreeCleanup, WorktreeInspection } from "../types";

// "remove" unbinds the session from its worktree and keeps the session; "delete"
// deletes the session and, under the same rules, its worktree.
export type WorktreeCleanupMode = "remove" | "delete";

export type WorktreeCleanupChoice = {
  kind: "default" | "keepBranch" | "discard";
  cleanup: WorktreeCleanup;
};

// The choices worth offering for what Core inspected, safest first. Core enforces the
// matrix again under its exclusive lease (ADR-0005); this only avoids offering a choice
// Core is certain to refuse. A discard carries exactly the HEAD and status digest the
// user is shown, so newer work refuses it as stale instead of being destroyed.
export function worktreeCleanupChoices(inspection: WorktreeInspection, mode: WorktreeCleanupMode): WorktreeCleanupChoice[] {
  const role = inspection.role || "";
  if (role === "") return mode === "delete" ? [{ kind: "default", cleanup: {} }] : [];
  if (role === "borrower") return [{ kind: "default", cleanup: {} }];
  if (role === "uncertain") return [{ kind: "keepBranch", cleanup: { keepBranch: true } }];

  const dirty = (inspection.dirtyFiles?.length ?? 0) > 0;
  const unapplied = (inspection.unappliedCommits?.length ?? 0) > 0;
  const ignored = (inspection.ignoredFiles?.length ?? 0) > 0;
  if (!dirty && !unapplied && !ignored) return [{ kind: "default", cleanup: {} }];

  const choices: WorktreeCleanupChoice[] = [];
  if (!dirty) choices.push({ kind: "keepBranch", cleanup: { keepBranch: true } });
  if (inspection.head) {
    choices.push({
      kind: "discard",
      cleanup: { discard: { expectHead: inspection.head, expectStatusDigest: inspection.statusDigest ?? "" } },
    });
  }
  return choices;
}
