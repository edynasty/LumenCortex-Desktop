import {
  CircleAlert,
  CircleDashed,
  CirclePause,
  CircleX,
  Eye,
  GitBranch,
  LoaderCircle,
  Play,
  ShieldAlert,
  Square,
  SquareArrowOutUpRight,
} from "lucide-react";
import type { ReactNode } from "react";
import type { TaskNotice } from "../../app/hooks/useThreadTasks";
import { findNode, runningNodes, taskPhase, verification, type TaskPhase, type Verification } from "../../lib/execution-tasks";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { SubagentNode, TaskResult, ThreadTask } from "../../types";

export type ExecutionTaskLabels = Pick<
  AppCopy,
  | "tasksTitle"
  | "taskProposed"
  | "taskStarting"
  | "taskRunning"
  | "taskRunningElsewhere"
  | "taskWaitingGate"
  | "taskInterrupted"
  | "taskFailed"
  | "taskFinished"
  | "taskUnknown"
  | "taskStart"
  | "taskStartHint"
  | "taskStartWhileRunning"
  | "taskOpen"
  | "taskStop"
  | "taskStopAll"
  | "taskVerifyPassed"
  | "taskVerifyFailed"
  | "taskVerifyPending"
  | "taskVerifyNone"
  | "taskVerifyError"
  | "taskDirtyFiles"
  | "taskUnappliedCommits"
  | "taskNoChanges"
  | "taskOpenUnits"
  | "taskWorktreeMissing"
  | "taskReviewHint"
  | "taskGateHint"
>;

type Props = {
  tasks: ThreadTask[];
  nodes: SubagentNode[];
  // The newest delivered task_result of each child, by child session id.
  results: Map<string, TaskResult>;
  // The parent runs (here or in another process): Core refuses a Start under its run lock.
  parentBusy: boolean;
  pending: Record<string, true>;
  notice: TaskNotice | null;
  labels: ExecutionTaskLabels;
  onStart: (taskId: string) => void;
  onStop: (sessionId: string) => void;
  onOpen: (sessionId: string) => void;
};

const phaseIcon: Record<TaskPhase, ReactNode> = {
  proposed: <CircleDashed size={13} strokeWidth={1.8} aria-hidden />,
  starting: <LoaderCircle size={13} strokeWidth={1.8} aria-hidden className="spin" />,
  running: <LoaderCircle size={13} strokeWidth={1.8} aria-hidden className="spin" />,
  running_elsewhere: <LoaderCircle size={13} strokeWidth={1.8} aria-hidden />,
  waiting_gate: <ShieldAlert size={13} strokeWidth={1.8} aria-hidden />,
  interrupted: <CirclePause size={13} strokeWidth={1.8} aria-hidden />,
  failed: <CircleX size={13} strokeWidth={1.8} aria-hidden />,
  finished: <Eye size={13} strokeWidth={1.8} aria-hidden />,
  unknown: <CircleAlert size={13} strokeWidth={1.8} aria-hidden />,
};

function phaseLabel(labels: ExecutionTaskLabels, phase: TaskPhase): string {
  switch (phase) {
    case "proposed": return labels.taskProposed;
    case "starting": return labels.taskStarting;
    case "running": return labels.taskRunning;
    case "running_elsewhere": return labels.taskRunningElsewhere;
    case "waiting_gate": return labels.taskWaitingGate;
    case "interrupted": return labels.taskInterrupted;
    case "failed": return labels.taskFailed;
    case "finished": return labels.taskFinished;
    default: return labels.taskUnknown;
  }
}

function verificationLabel(labels: ExecutionTaskLabels, value: Verification): string {
  switch (value) {
    case "passed": return labels.taskVerifyPassed;
    case "failed": return labels.taskVerifyFailed;
    case "pending": return labels.taskVerifyPending;
    case "error": return labels.taskVerifyError;
    default: return labels.taskVerifyNone;
  }
}

// The facts of a delivered result that matter at a glance: verification, changes, open units.
export function ResultFacts({ result, labels }: { result: TaskResult; labels: ExecutionTaskLabels }) {
  const verified = verification(result);
  const handoff = result.handoff;
  const openUnits = result.openUnits?.length ?? 0;
  return (
    <>
      <span className={`task-fact verify-${verified}`}>{verificationLabel(labels, verified)}</span>
      {handoff && !handoff.exists && <span className="task-fact warn">{labels.taskWorktreeMissing}</span>}
      {handoff?.exists && handoff.dirtyCount === 0 && handoff.unappliedCommits === 0 && (
        <span className="task-fact">{labels.taskNoChanges}</span>
      )}
      {handoff?.exists && handoff.unappliedCommits > 0 && (
        <span className="task-fact">{labels.taskUnappliedCommits.replace("{count}", String(handoff.unappliedCommits))}</span>
      )}
      {handoff?.exists && handoff.dirtyCount > 0 && (
        <span className="task-fact">{labels.taskDirtyFiles.replace("{count}", String(handoff.dirtyCount))}</span>
      )}
      {openUnits > 0 && <span className="task-fact">{labels.taskOpenUnits.replace("{count}", String(openUnits))}</span>}
    </>
  );
}

function TaskRow({
  task,
  node,
  result,
  parentBusy,
  pending,
  labels,
  onStart,
  onStop,
  onOpen,
}: {
  task: ThreadTask;
  node?: SubagentNode;
  result?: TaskResult;
  parentBusy: boolean;
  pending: Record<string, true>;
  labels: ExecutionTaskLabels;
  onStart: (taskId: string) => void;
  onStop: (sessionId: string) => void;
  onOpen: (sessionId: string) => void;
}) {
  const phase = taskPhase(task, node);
  const childId = task.sessionId;
  // A delivered result describes the run it was delivered for; it is shown only while the child
  // still has that status, so a resumed child never shows its previous outcome.
  const current = result && node && result.status === node.status ? result : undefined;
  const branch = node?.runtime?.branch;
  const starting = pending[task.id] === true;
  const stopping = childId ? pending[childId] === true : false;

  return (
    <li className={`task-row phase-${phase}`}>
      <span className="task-row-icon">{phaseIcon[phase]}</span>
      <div className="task-row-body">
        <p className="task-row-objective" title={task.objective}>{task.objective}</p>
        <div className="task-row-meta">
          <span className="task-phase">{phaseLabel(labels, phase)}</span>
          {branch && (
            <span className="task-fact mono" title={node?.runtime?.path}>
              <GitBranch size={10} strokeWidth={1.8} aria-hidden />
              {branch}
            </span>
          )}
          {current && <ResultFacts result={current} labels={labels} />}
        </div>
        {phase === "proposed" && <p className="task-row-hint">{parentBusy ? labels.taskStartWhileRunning : labels.taskStartHint}</p>}
        {phase === "finished" && !current && <p className="task-row-hint">{labels.taskReviewHint}</p>}
        {phase === "waiting_gate" && <p className="task-row-hint">{labels.taskGateHint}</p>}
        {current?.error && (phase === "failed" || phase === "interrupted") && (
          <p className="task-row-error">{current.error}</p>
        )}
      </div>
      <div className="task-row-actions">
        {phase === "proposed" && (
          <button
            type="button"
            className="task-action primary"
            disabled={starting || parentBusy}
            onClick={() => onStart(task.id)}
          >
            {starting ? <LoaderCircle size={11} strokeWidth={1.9} aria-hidden className="spin" /> : <Play size={11} strokeWidth={1.9} aria-hidden />}
            {labels.taskStart}
          </button>
        )}
        {phase === "running" && childId && (
          <button
            type="button"
            className="task-action"
            disabled={stopping}
            aria-label={`${labels.taskStop}: ${task.objective}`}
            onClick={() => onStop(childId)}
          >
            <Square size={10} strokeWidth={2} aria-hidden />
            {labels.taskStop}
          </button>
        )}
        {childId && (
          <button
            type="button"
            className="task-action ghost"
            aria-label={`${labels.taskOpen}: ${task.objective}`}
            onClick={() => onOpen(childId)}
          >
            <SquareArrowOutUpRight size={11} strokeWidth={1.8} aria-hidden />
            {labels.taskOpen}
          </button>
        )}
      </div>
    </li>
  );
}

// ExecutionTasks lists the thread's execution tasks, newest first: proposals the user can start and
// started tasks with their run state. It shows Core's state only; nothing is assumed after an action.
export function ExecutionTasks({
  tasks,
  nodes,
  results,
  parentBusy,
  pending,
  notice,
  labels,
  onStart,
  onStop,
  onOpen,
}: Props) {
  if (tasks.length === 0) return null;
  const ordered = [...tasks].reverse();
  const executionNodes = nodes.filter((node) => node.kind === "execution");
  const { here } = runningNodes(executionNodes);
  const parentId = executionNodes[0]?.parentSessionId;

  return (
    <section className="execution-tasks" aria-label={labels.tasksTitle}>
      <header className="execution-tasks-head">
        <strong>{labels.tasksTitle}</strong>
        <span className="execution-tasks-count">{tasks.length}</span>
        {/* While the parent runs, the composer's Stop already ends the whole subtree. */}
        {here.length > 1 && parentId && !parentBusy && (
          <button
            type="button"
            className="task-action"
            disabled={pending[parentId] === true}
            onClick={() => onStop(parentId)}
          >
            <Square size={10} strokeWidth={2} aria-hidden />
            {labels.taskStopAll}
          </button>
        )}
      </header>
      {notice && <p className={`execution-tasks-notice ${notice.tone}`} role={notice.tone === "danger" ? "alert" : "status"}>{notice.text}</p>}
      <ul>
        {ordered.map((task) => {
          const node = task.sessionId ? findNode(nodes, task.sessionId) : undefined;
          return (
            <TaskRow
              key={task.id}
              task={task}
              node={node}
              result={task.sessionId ? results.get(task.sessionId) : undefined}
              parentBusy={parentBusy}
              pending={pending}
              labels={labels}
              onStart={onStart}
              onStop={onStop}
              onOpen={onOpen}
            />
          );
        })}
      </ul>
    </section>
  );
}
