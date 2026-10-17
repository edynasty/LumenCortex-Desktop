import { useCallback, useEffect, useRef, useState } from "react";
import { bridge } from "../../lib/bridge";
import type { CheckArtifact, CheckResult, ChecksInfo, RuntimeEvent } from "../../types";

export const checkResultsPage = 20;

// Events after which Core's checks view may differ: the completion gate runs checks inside a run (its
// verdicts move Task State), an acceptance, and worktree changes that move the fingerprint.
function changesChecks(event: RuntimeEvent): boolean {
  if (event.type.startsWith("task_state.")) return true;
  switch (event.type) {
    case "run.stopped":
    case "check.accepted":
    case "worktree.applied":
    case "worktree.removed":
      return true;
    default:
      return false;
  }
}

type Options = {
  sessionId: string;
  events: RuntimeEvent[];
  // Changes when the global configuration changes (trusting the workspace adds its checks).
  configKey: string;
};

// useChecks keeps Core's view of the session's checks and the newest page of results. The fingerprint
// also moves with edits Core publishes no event for, so the panel offers a manual refresh.
export function useChecks({ sessionId, events, configKey }: Options) {
  const [info, setInfo] = useState<ChecksInfo | null>(null);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [artifact, setArtifact] = useState<CheckArtifact | null>(null);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState("");
  const lastSeq = useRef(-1);
  const current = useRef(sessionId);
  current.current = sessionId;

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [next, page] = await Promise.all([bridge.sessionChecks(sessionId), bridge.checkResults(sessionId, -1, checkResultsPage)]);
      if (current.current !== sessionId) return;
      const rows = page ?? [];
      setInfo(next);
      setResults(rows);
      setHasMore(rows.length === checkResultsPage);
      setError("");
    } catch (err) {
      if (current.current === sessionId) setError(String(err));
    }
  }, [sessionId]);

  useEffect(() => {
    setInfo(null);
    setResults([]);
    setHasMore(false);
    setArtifact(null);
    setError("");
    lastSeq.current = events.length ? events[events.length - 1].seq : -1;
    void load();
    // events is read here only to start after the newest event already seen.
  }, [sessionId, configKey, load]);

  useEffect(() => {
    let refresh = false;
    for (const event of events) {
      if (event.seq <= lastSeq.current) continue;
      if (event.sessionId === sessionId && changesChecks(event)) refresh = true;
    }
    if (events.length) lastSeq.current = Math.max(lastSeq.current, events[events.length - 1].seq);
    if (refresh) void load();
  }, [events, sessionId, load]);

  const loadMore = useCallback(async () => {
    const oldest = results[results.length - 1]?.seq;
    if (!sessionId || !oldest) return;
    try {
      const rows = (await bridge.checkResults(sessionId, oldest, checkResultsPage)) ?? [];
      if (current.current !== sessionId) return;
      setResults((prev) => [...prev, ...rows.filter((row) => !prev.some((p) => p.seq === row.seq))]);
      setHasMore(rows.length === checkResultsPage);
    } catch (err) {
      if (current.current === sessionId) setError(String(err));
    }
  }, [sessionId, results]);

  const accept = useCallback(
    async (checkId: string) => {
      if (!sessionId) return;
      setAccepting(checkId);
      setError("");
      try {
        await bridge.acceptCheck(sessionId, checkId);
        await load();
      } catch (err) {
        if (current.current === sessionId) setError(String(err));
      } finally {
        setAccepting("");
      }
    },
    [sessionId, load],
  );

  // Opening the artifact already shown closes it.
  const toggleArtifact = useCallback(
    async (hash: string) => {
      if (!sessionId) return;
      if (artifact?.hash === hash) {
        setArtifact(null);
        return;
      }
      try {
        const next = await bridge.checkArtifact(sessionId, hash);
        if (current.current === sessionId) setArtifact(next);
      } catch (err) {
        if (current.current === sessionId) setError(String(err));
      }
    },
    [sessionId, artifact],
  );

  return { info, results, hasMore, artifact, error, accepting, refresh: load, loadMore, accept, toggleArtifact, closeArtifact: () => setArtifact(null) };
}
