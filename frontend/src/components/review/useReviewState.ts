import { useCallback, useEffect, useMemo, useState } from "react";
import { bridge } from "../../lib/bridge";
import type { GitActionResult, GitDiff, GitFileStatus, GitStatus, WorktreeConflict } from "../../types";

export type DiffScope = "worktree" | "staged";

/**
 * The Git surface a review reads and acts on: one session's worktree, or the project checkout
 * (Source Control's "main" selection). Every call is Core's, so the same non-optimistic
 * refresh-after-mutation flow covers both.
 */
export type GitEndpoint = {
  status: () => Promise<GitStatus>;
  diff: (path: string, staged: boolean) => Promise<GitDiff>;
  stage: (path: string) => Promise<GitActionResult>;
  unstage: (path: string) => Promise<GitActionResult>;
  revert: (path: string) => Promise<GitActionResult>;
  commit: (message: string) => Promise<GitActionResult>;
  push: () => Promise<GitActionResult>;
};

export function sessionGitEndpoint(sessionId: string): GitEndpoint {
  return {
    status: () => bridge.sessionGitStatus(sessionId),
    diff: (path, staged) => bridge.sessionGitDiff(sessionId, path, staged),
    stage: (path) => bridge.sessionGitStage(sessionId, path),
    unstage: (path) => bridge.sessionGitUnstage(sessionId, path),
    revert: (path) => bridge.sessionGitRevert(sessionId, path),
    commit: (message) => bridge.sessionGitCommit(sessionId, message),
    push: () => bridge.sessionGitPush(sessionId),
  };
}

export function checkoutGitEndpoint(): GitEndpoint {
  return {
    status: () => bridge.gitStatus(),
    diff: (path, staged) => bridge.gitDiff(path, staged),
    stage: (path) => bridge.gitStage(path),
    unstage: (path) => bridge.gitUnstage(path),
    revert: (path) => bridge.gitRevert(path),
    commit: (message) => bridge.gitCommit(message),
    push: () => bridge.gitPush(),
  };
}

// The letter shown for a file: the staged code when staged, else the worktree code; "??" is an
// untracked file, shown as U.
export function statusLabel(index: string, worktree: string) {
  if (index === "?" && worktree === "?") return "U";
  if (index !== " " && index !== "?") return index;
  return worktree === " " ? "M" : worktree;
}

export function useReviewState(source: string | GitEndpoint) {
  const [status, setStatus] = useState<GitStatus>({ files: [] });
  const [conflicts, setConflicts] = useState<WorktreeConflict[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [scope, setScope] = useState<DiffScope>("worktree");
  const [diff, setDiff] = useState<GitDiff>({ content: "", bytes: 0, truncated: false, staged: false });
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const git = useMemo(
    () => (typeof source === "string" ? sessionGitEndpoint(source) : source),
    [source],
  );

  const refresh = useCallback(async () => {
    if (typeof source === "string" && !source) {
      setStatus({ files: [] });
      setConflicts([]);
      setSelectedPath("");
      return;
    }
    setLoading(true);
    try {
      const [next, nextConflicts] = await Promise.all([
        git.status(),
        bridge.worktreeConflicts(),
      ]);
      setStatus(next);
      setConflicts(nextConflicts);
      setSelectedPath((current) =>
        current && next.files.some((item) => item.path === current)
          ? current
          : next.files[0]?.path || ""
      );
      setError("");
      setRevision((value) => value + 1);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [git, source]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if ((typeof source === "string" && !source) || !selectedPath) {
      setDiff({ content: "", bytes: 0, truncated: false, staged: scope === "staged" });
      return;
    }
    let cancelled = false;
    setLoading(true);
    git.diff(selectedPath, scope === "staged")
      .then((next) => {
        if (!cancelled) {
          setDiff(next);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [git, source, selectedPath, scope]);

  const selectedFile = useMemo<GitFileStatus | undefined>(
    () => status.files.find((item) => item.path === selectedPath),
    [selectedPath, status.files]
  );

  async function action(run: () => Promise<{ output: string }>) {
    setActionBusy(true);
    try {
      const result = await run();
      setNotice(result.output || "Done");
      setError("");
      await refresh();
      if (selectedPath) {
        setDiff(await git.diff(selectedPath, scope === "staged"));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setActionBusy(false);
    }
  }

  return {
    status,
    conflicts,
    selectedPath,
    setSelectedPath,
    selectedFile,
    scope,
    setScope,
    diff,
    loading,
    actionBusy,
    notice,
    error,
    revision,
    refresh,
    stage: () => selectedPath && action(() => git.stage(selectedPath)),
    unstage: () => selectedPath && action(() => git.unstage(selectedPath)),
    revert: () => selectedPath && action(() => git.revert(selectedPath)),
    commit: (message: string) => action(() => git.commit(message)),
    push: () => action(() => git.push()),
  };
}
