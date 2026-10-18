import { useCallback, useMemo, useState } from "react";
import { useTaskState } from "../../components/inspector/useTaskState";
import { bridge } from "../../lib/bridge";
import { findNode, runningNodes } from "../../lib/execution-tasks";
import type { RuntimeEvent, SubagentNode } from "../../types";

export type TaskNotice = { tone: "info" | "danger"; text: string };

type Options = {
  sessionId: string;
  events: RuntimeEvent[];
  subagents: SubagentNode[];
  // Re-reads the thread's session, transcript and SubagentTree from Core.
  refreshThread: (sessionId: string) => Promise<void>;
  // Formats an error or a count for display; the hook keeps no copy of its own.
  presentError: (error: string) => string;
  stopElsewhereText: (count: number) => string;
  stopNoneText: string;
};

// useThreadTasks is the thread's view of its execution tasks: Task State (Core's host view) for what
// was proposed or started, SubagentTree for each child's run, and the two user actions. Nothing here
// is stored: after every action both are read again from Core, so a proposal shows as started only
// once Core's Task State says so.
export function useThreadTasks({
  sessionId,
  events,
  subagents,
  refreshThread,
  presentError,
  stopElsewhereText,
  stopNoneText,
}: Options) {
  const taskState = useTaskState({ sessionId, events });
  // Actions in flight, by task id (start) or child session id (stop); a second click is ignored.
  const [pending, setPending] = useState<Record<string, true>>({});
  const [notice, setNotice] = useState<TaskNotice | null>(null);

  const mark = useCallback((key: string, on: boolean) => {
    setPending((current) => {
      const next = { ...current };
      if (on) next[key] = true;
      else delete next[key];
      return next;
    });
  }, []);

  const reread = useCallback(async () => {
    await Promise.all([taskState.refresh(), refreshThread(sessionId).catch(() => undefined)]);
  }, [refreshThread, sessionId, taskState]);

  const start = useCallback(async (taskId: string) => {
    if (!sessionId || pending[taskId]) return;
    mark(taskId, true);
    setNotice(null);
    try {
      await bridge.startProposedTask(sessionId, taskId);
    } catch (err) {
      setNotice({ tone: "danger", text: presentError(String(err)) });
    } finally {
      mark(taskId, false);
      await reread();
    }
  }, [mark, pending, presentError, reread, sessionId]);

  // stop cancels target and its descendants (CancelSubtree). Runs another process holds are not
  // reachable from here, and the notice says so instead of reporting them stopped.
  const stop = useCallback(async (target: string) => {
    if (!target || pending[target]) return;
    const subtree = target === sessionId ? subagents : (() => {
      const node = findNode(subagents, target);
      return node ? [node] : [];
    })();
    const { elsewhere } = runningNodes(subtree);
    mark(target, true);
    setNotice(null);
    try {
      const cancelled = await bridge.cancelSubtree(target);
      if (elsewhere.length > 0) setNotice({ tone: "info", text: stopElsewhereText(elsewhere.length) });
      else if (cancelled.length === 0) setNotice({ tone: "info", text: stopNoneText });
    } catch (err) {
      setNotice({ tone: "danger", text: presentError(String(err)) });
    } finally {
      mark(target, false);
      await reread();
    }
  }, [mark, pending, presentError, reread, sessionId, stopElsewhereText, stopNoneText, subagents]);

  const tasks = useMemo(() => taskState.info?.state.tasks ?? [], [taskState.info]);

  return {
    info: taskState.info,
    tasks,
    pending,
    notice,
    clearNotice: () => setNotice(null),
    start,
    stop,
  };
}
