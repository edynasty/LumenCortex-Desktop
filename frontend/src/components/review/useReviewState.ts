import { useCallback, useEffect, useMemo, useState } from "react";
import { bridge } from "../../lib/bridge";
import type { GitDiff, GitFileStatus, GitStatus } from "../../types";

export type DiffScope = "worktree" | "staged";

export function useReviewState(sessionId: string) {
  const [status, setStatus] = useState<GitStatus>({ files: [] });
  const [selectedPath, setSelectedPath] = useState("");
  const [scope, setScope] = useState<DiffScope>("worktree");
  const [diff, setDiff] = useState<GitDiff>({ content: "", bytes: 0, truncated: false, staged: false });
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setStatus({ files: [] });
      setSelectedPath("");
      return;
    }
    setLoading(true);
    try {
      const next = await bridge.sessionGitStatus(sessionId);
      setStatus(next);
      setSelectedPath((current) =>
        current && next.files.some((item) => item.path === current)
          ? current
          : next.files[0]?.path || ""
      );
      setError("");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!sessionId || !selectedPath) {
      setDiff({ content: "", bytes: 0, truncated: false, staged: scope === "staged" });
      return;
    }
    let cancelled = false;
    setLoading(true);
    bridge.sessionGitDiff(sessionId, selectedPath, scope === "staged")
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
  }, [sessionId, selectedPath, scope]);

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
        setDiff(await bridge.sessionGitDiff(sessionId, selectedPath, scope === "staged"));
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setActionBusy(false);
    }
  }

  return {
    status,
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
    refresh,
    stage: () => selectedPath && action(() => bridge.sessionGitStage(sessionId, selectedPath)),
    unstage: () => selectedPath && action(() => bridge.sessionGitUnstage(sessionId, selectedPath)),
    revert: () => selectedPath && action(() => bridge.sessionGitRevert(sessionId, selectedPath)),
    commit: (message: string) => action(() => bridge.sessionGitCommit(sessionId, message)),
    push: () => action(() => bridge.sessionGitPush(sessionId)),
  };
}
