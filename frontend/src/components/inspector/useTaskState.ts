import { useCallback, useEffect, useRef, useState } from "react";
import { bridge } from "../../lib/bridge";
import type { RuntimeEvent, TaskReferenceEdit, TaskResolutionState, TaskStateInfo } from "../../types";

// Events after which the host view of Task State may differ: Task State versions and queued edits,
// a context reset, the end of a run, and changes to the evidence the resolution reads.
function changesTaskState(event: RuntimeEvent): boolean {
  if (event.type.startsWith("task_state.")) return true;
  switch (event.type) {
    case "context.reset":
    case "run.started":
    case "run.stopped":
    case "workflow.approved":
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
};

// useTaskState keeps Core's host view of the session's Task State. Every edit returns the new view, so
// the panel never guesses the result; runtime events trigger a re-read.
export function useTaskState({ sessionId, events }: Options) {
  const [info, setInfo] = useState<TaskStateInfo | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lastSeq = useRef(-1);
  const current = useRef(sessionId);
  current.current = sessionId;

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const next = await bridge.taskState(sessionId);
      if (current.current === sessionId) setInfo(next);
    } catch (err) {
      if (current.current === sessionId) setError(String(err));
    }
  }, [sessionId]);

  useEffect(() => {
    setInfo(null);
    setError("");
    lastSeq.current = events.length ? events[events.length - 1].seq : -1;
    void load();
    // events is read here only to start after the newest event already seen.
  }, [sessionId, load]);

  useEffect(() => {
    let refresh = false;
    for (const event of events) {
      if (event.seq <= lastSeq.current) continue;
      if (event.sessionId === sessionId && changesTaskState(event)) refresh = true;
    }
    if (events.length) lastSeq.current = Math.max(lastSeq.current, events[events.length - 1].seq);
    if (refresh) void load();
  }, [events, sessionId, load]);

  const apply = useCallback(
    async (edit: () => Promise<TaskStateInfo>) => {
      if (!sessionId) return false;
      setBusy(true);
      setError("");
      try {
        const next = await edit();
        if (current.current === sessionId) setInfo(next);
        return true;
      } catch (err) {
        if (current.current === sessionId) setError(String(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [sessionId],
  );

  return {
    info,
    error,
    busy,
    setBrief: (brief: string) => apply(() => bridge.setTaskBrief(sessionId, brief)),
    editReference: (edit: TaskReferenceEdit) => apply(() => bridge.editTaskReference(sessionId, edit)),
    resolve: (state: TaskResolutionState) => apply(() => bridge.resolveThread(sessionId, state)),
    resetContext: () => apply(() => bridge.resetContext(sessionId)),
  };
}
