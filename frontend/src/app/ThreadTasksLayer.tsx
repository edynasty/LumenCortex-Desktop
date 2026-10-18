import { useCallback, useMemo, type ReactNode } from "react";
import { DelegationControl } from "../components/thread/DelegationControl";
import { ExecutionTasks } from "../components/thread/ExecutionTasks";
import { TaskResultNotice } from "../components/thread/TaskResultNotice";
import { presentError } from "../lib/error-presentation";
import { latestTaskResults, taskResultOf } from "../lib/execution-tasks";
import type { AppCopy } from "../lib/i18n/app-copy";
import { isRunningElsewhere } from "../lib/session-status";
import { sessionUI } from "../lib/session-ui";
import type { Delegation, Message, RuntimeEvent, Session, SubagentNode } from "../types";
import { useThreadTasks } from "./hooks/useThreadTasks";

export type ThreadTaskExtras = {
  resolution?: { label: string; tone: "open" | "review" | "done" | "dropped"; title: string };
  tasks: ReactNode;
  delegationControl: ReactNode;
  renderRuntimeRow: (message: Message) => ReactNode | null;
};

type Props = {
  session: Session;
  events: RuntimeEvent[];
  subagents: SubagentNode[];
  messages: Message[];
  running: boolean;
  busy: boolean;
  labels: AppCopy;
  onRefreshThread: (sessionId: string) => Promise<void>;
  onOpenSession: (sessionId: string) => void;
  onDelegationChange: (sessionId: string, delegation: Delegation) => void;
  children: (extras: ThreadTaskExtras) => ReactNode;
};

// ThreadTasksLayer gives a thread its C3 surface (ADR-0006 D2/D4): the resolution next to the run
// status, the delegation grant, execution task cards and task_result rows. Every value is read from
// Core (Task State, SubagentTree, the transcript); the layer stores none of them.
export function ThreadTasksLayer({
  session,
  events,
  subagents,
  messages,
  running,
  busy,
  labels,
  onRefreshThread,
  onOpenSession,
  onDelegationChange,
  children,
}: Props) {
  const ui = sessionUI(session);
  const present = useCallback((error: string) => presentError(labels, error), [labels]);
  const stopElsewhere = useCallback((count: number) => labels.taskStopElsewhere.replace("{count}", String(count)), [labels]);
  const thread = useThreadTasks({
    sessionId: session.id,
    events,
    subagents,
    refreshThread: onRefreshThread,
    presentError: present,
    stopElsewhereText: stopElsewhere,
    stopNoneText: labels.taskStopNone,
  });
  const results = useMemo(() => latestTaskResults(messages), [messages]);

  const info = thread.info;
  let resolution: ThreadTaskExtras["resolution"];
  if (info) {
    const state = info.state.resolution.state;
    const tone = state === "done" ? "done" : state === "dropped" ? "dropped" : info.readyForReview ? "review" : "open";
    const text =
      tone === "done" ? labels.taskResolutionDone :
      tone === "dropped" ? labels.taskResolutionDropped :
      tone === "review" ? labels.taskReadyForReview :
      labels.taskResolutionOpen;
    resolution = { tone, label: text, title: `${labels.taskResolution}: ${text}` };
  }

  // Core refuses a proposal's Start under the parent's run lock: while it runs here or elsewhere.
  const parentBusy = running || isRunningElsewhere(session.status, running);

  return (
    <>
      {children({
        resolution,
        tasks: (
          <ExecutionTasks
            tasks={thread.tasks}
            nodes={subagents}
            results={results}
            parentBusy={parentBusy}
            pending={thread.pending}
            notice={thread.notice}
            labels={labels}
            onStart={(taskId) => void thread.start(taskId)}
            onStop={(sessionId) => void thread.stop(sessionId)}
            onOpen={onOpenSession}
          />
        ),
        delegationControl: (
          <DelegationControl
            value={ui.delegation}
            fixed={Boolean(ui.parentSessionId)}
            disabled={busy}
            labels={labels}
            onChange={(value) => onDelegationChange(session.id, value)}
          />
        ),
        renderRuntimeRow: (message) => {
          const result = taskResultOf(message);
          if (!result) return null;
          return (
            <TaskResultNotice
              key={`${message.seq}-task-result`}
              seq={message.seq}
              result={result}
              labels={labels}
              onOpen={onOpenSession}
            />
          );
        },
      })}
    </>
  );
}
