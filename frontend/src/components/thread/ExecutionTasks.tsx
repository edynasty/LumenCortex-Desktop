import type { ReactNode } from "react";
import type { TaskNotice } from "../../app/hooks/useThreadTasks";
import { findNode, runningNodes, taskPhase, verification, type TaskPhase, type Verification } from "../../lib/execution-tasks";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { SubagentNode, TaskResult, ThreadTask } from "../../types";
import { LumenIndicator } from "../brand/A1Mark";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import type { IconName } from "../primitives/icons";

export type ExecutionTaskLabels = Pick<
  AppCopy,
  | "tasksTitle"
  | "taskKicker"
  | "proposalKicker"
  | "taskAgent"
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

const phaseIcon: Record<TaskPhase, IconName> = {
  proposed: "idle",
  starting: "task",
  running: "task",
  running_elsewhere: "task",
  waiting_gate: "gate",
  interrupted: "interrupted",
  failed: "failed",
  finished: "review",
  unknown: "failed",
};

/** The tone of the run state chip; unknown states stay quiet. */
const phaseTone: Record<TaskPhase, string> = {
  proposed: "",
  starting: "tone-running",
  running: "tone-running",
  running_elsewhere: "tone-info",
  waiting_gate: "tone-waiting_gate",
  interrupted: "tone-failed",
  failed: "tone-failed",
  finished: "tone-completed",
  unknown: "",
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

function TaskCard({
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
  // The proposal names its agent before a child exists; the child's pin after.
  const agentId = node?.agent || task.agent;
  const starting = pending[task.id] === true;
  const stopping = childId ? pending[childId] === true : false;

  return (
    <li className={`block task-block phase-${phase}`}>
      <header className="block-head">
        <span className="block-icon">
          {phase === "starting" || phase === "running" ? (
            <LumenIndicator size={16} />
          ) : (
            <Icon name={phaseIcon[phase]} size={16} />
          )}
        </span>
        <span className="block-kicker">{phase === "proposed" ? labels.proposalKicker : labels.taskKicker}</span>
        <h3 className="task-objective" title={task.objective}>{task.objective}</h3>
        <span className={`task-state ${phaseTone[phase]}`}>{phaseLabel(labels, phase)}</span>
      </header>
      <div className="task-meta">
        {agentId && (
          <span className="task-agent" title={labels.taskAgent} aria-label={`${labels.taskAgent}: ${agentId}`}>
            <Icon name="agents" size={12} />
            {agentId}
          </span>
        )}
        {branch && (
          <span className="task-branch" title={node?.runtime?.path}>
            <Icon name="worktree" size={12} />
            {branch}
          </span>
        )}
        {current && <ResultFacts result={current} labels={labels} />}
      </div>
      {phase === "proposed" && <p className="task-row-hint">{parentBusy ? labels.taskStartWhileRunning : labels.taskStartHint}</p>}
      {phase === "finished" && !current && <p className="task-row-hint">{labels.taskReviewHint}</p>}
      {phase === "waiting_gate" && <p className="task-row-hint">{labels.taskGateHint}</p>}
      {current?.error && (phase === "failed" || phase === "interrupted") && (
        <pre className="block-code">{current.error}</pre>
      )}
      <footer className="block-actions">
        {phase === "proposed" && (
          <Button
            variant="primary"
            size="sm"
            icon={<Icon name="task" size={12} />}
            disabled={starting || parentBusy}
            onClick={() => onStart(task.id)}
          >
            {labels.taskStart}
          </Button>
        )}
        {phase === "running" && childId && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="stop" size={12} />}
            disabled={stopping}
            aria-label={`${labels.taskStop}: ${task.objective}`}
            onClick={() => onStop(childId)}
          >
            {labels.taskStop}
          </Button>
        )}
        {childId && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Icon name="expand" size={12} />}
            aria-label={`${labels.taskOpen}: ${task.objective}`}
            onClick={() => onOpen(childId)}
          >
            {labels.taskOpen}
          </Button>
        )}
      </footer>
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
            className="btn btn-ghost btn-sm"
            disabled={pending[parentId] === true}
            onClick={() => onStop(parentId)}
          >
            <Icon name="stop" size={12} />
            {labels.taskStopAll}
          </button>
        )}
      </header>
      {notice && <p className={`execution-tasks-notice ${notice.tone}`} role={notice.tone === "danger" ? "alert" : "status"}>{notice.text}</p>}
      <ul>
        {ordered.map((task) => {
          const node = task.sessionId ? findNode(nodes, task.sessionId) : undefined;
          return (
            <TaskCard
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
