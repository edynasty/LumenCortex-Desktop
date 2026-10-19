/*
 * The Source Control page's controller (contract for the integrator): returns the sidebar
 * body and the main view for route.kind === "scm". The sidebar lists the project checkout
 * (change count from Core) and every worktree session with its branch, status and pending
 * counts; the content is the project checkout or one worktree. All data is Core's — the
 * per-worktree inspection, the project git status, and (inside the views) the review state.
 * Loading is lazy (only while the route is active) and re-queries after every mutation.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "../../types";
import type { AppCopy, Locale } from "../../lib/i18n/app-copy";
import { bridge } from "../../lib/bridge";
import { sessionRuntime } from "../../lib/session-runtime";
import { sessionUI } from "../../lib/session-ui";
import { ScmSidebar, type ScmWorktreeRow } from "./ScmSidebar";
import { ScmCheckoutView } from "./ScmCheckoutView";
import { ScmWorktreeView } from "./ScmWorktreeView";
import type { ScmGraphWorktree } from "./ScmBranchGraph";
import type { WorktreeCleanupTarget } from "../worktree/WorktreeCleanupDialog";
import type { WorktreeInspection } from "../../types";
import "./scm.css";

/** Worktree sessions shown; the session list itself is already bounded by the workspace. */
const WORKTREE_BOUND = 30;

export function useSourceControlPage(input: {
  enabled: boolean;
  workspace: string;
  sessions: Session[];
  checkout: "main" | string;
  labels: AppCopy;
  locale: Locale;
  onSelectCheckout: (checkout: "main" | string) => void;
  onOpenThread: (sessionId: string) => void;
  onCleanupWorktree: (target: WorktreeCleanupTarget) => void;
  onError: (message: string) => void;
}): { sidebar: ReactNode; content: ReactNode } {
  const { enabled, workspace, sessions, checkout, labels, onSelectCheckout, onOpenThread, onCleanupWorktree, onError } = input;

  const [mainCount, setMainCount] = useState<number | undefined>(undefined);
  const [inspections, setInspections] = useState<Record<string, WorktreeInspection>>({});
  const [revision, setRevision] = useState(0);

  const worktrees = useMemo<ScmWorktreeRow[]>(
    () => sessions
      .filter((session) => sessionRuntime(session, workspace).kind === "worktree")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, WORKTREE_BOUND)
      .map((session) => {
        const runtime = sessionRuntime(session, workspace);
        return runtime.kind === "worktree"
          ? { session, runtime, title: sessionUI(session).title }
          : null;
      })
      .filter((row): row is ScmWorktreeRow => row !== null),
    [sessions, workspace],
  );

  // The worktree ids on screen; changes when a session moves in or out of a worktree.
  const worktreeRevision = useMemo(() => worktrees.map((row) => row.session.id).join("|"), [worktrees]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const [status, rows] = await Promise.all([
          bridge.gitStatus(),
          Promise.all(
            worktrees.map((row) =>
              bridge.inspectSessionWorktree(row.session.id).then(
                (inspection): [string, WorktreeInspection] | null => [row.session.id, inspection],
                (): [string, WorktreeInspection] | null => null,
              ),
            ),
          ),
        ]);
        if (cancelled) return;
        setMainCount(status.files.length);
        const next: Record<string, WorktreeInspection> = {};
        let failed = false;
        rows.forEach((row) => {
          if (row) next[row[0]] = row[1];
          else failed = true;
        });
        setInspections((current) => ({ ...current, ...next }));
        if (failed) onError(labels.contextStateError);
      } catch {
        if (!cancelled) onError(labels.contextStateError);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labels/onError are stable app callbacks; the fetch follows the page, the worktree set and the mutation revision only
  }, [enabled, worktreeRevision, revision]);

  const counts = useMemo(() => {
    if (Object.keys(inspections).length === 0) return undefined;
    const map: Record<string, { ahead: number; dirty: number }> = {};
    worktrees.forEach((row) => {
      const inspection = inspections[row.session.id];
      if (inspection) {
        map[row.session.id] = {
          ahead: inspection.unappliedCommits?.length ?? 0,
          dirty: inspection.dirtyFiles?.length ?? 0,
        };
      }
    });
    return map;
  }, [inspections, worktrees]);

  const graphWorktrees = useMemo<ScmGraphWorktree[]>(
    () => worktrees.map((row) => {
      const inspection = inspections[row.session.id];
      return {
        sessionId: row.session.id,
        branch: row.runtime.branch || row.runtime.path,
        dirty: inspection?.dirtyFiles?.length ?? 0,
        commits: inspection?.unappliedCommits ?? [],
      };
    }),
    [worktrees, inspections],
  );

  // The base branch and HEAD the worktrees fork from: the first worktree that names one.
  const base = useMemo(() => {
    for (const row of worktrees) {
      if (row.runtime.kind !== "worktree") continue;
      return {
        branch: row.runtime.base || "",
        head: inspections[row.session.id]?.targetHead,
      };
    }
    return { branch: "", head: undefined };
  }, [worktrees, inspections]);

  const selected = worktrees.find((row) => row.session.id === checkout);

  const sidebar = (
    <ScmSidebar
      workspace={workspace}
      checkout={checkout}
      worktrees={worktrees}
      counts={counts}
      mainCount={mainCount}
      labels={labels}
      onSelectCheckout={onSelectCheckout}
    />
  );

  if (!enabled) return { sidebar, content: null };

  if (selected) {
    return {
      sidebar,
      content: (
        <ScmWorktreeView
          key={selected.session.id}
          session={selected.session}
          runtime={selected.runtime}
          inspection={inspections[selected.session.id] ?? null}
          labels={labels}
          onOpenThread={onOpenThread}
          onCleanupWorktree={onCleanupWorktree}
          onApplied={() => setRevision((value) => value + 1)}
        />
      ),
    };
  }

  return {
    sidebar,
    content: (
      <ScmCheckoutView
        workspace={workspace}
        worktrees={graphWorktrees}
        baseBranch={base.branch}
        baseHead={base.head}
        changeCount={mainCount}
        revision={revision}
        labels={labels}
        onSelectCheckout={onSelectCheckout}
      />
    ),
  };
}
