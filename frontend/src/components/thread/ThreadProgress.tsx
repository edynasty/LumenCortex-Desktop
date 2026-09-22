import { Bot, CircleDot, ListChecks, ShieldCheck } from "lucide-react";
import type { WorkflowSummary } from "../../types";

type Props = {
  running: boolean;
  status: string;
  workflow?: WorkflowSummary | null;
  activeSubagents: number;
  labels: {
    plan: string;
    running: string;
    waiting: string;
    subagents: string;
  };
};

export function ThreadProgress({ running, status, workflow, activeSubagents, labels }: Props) {
  const waiting = status === "waiting_gate";
  const visible = running || waiting || Boolean(workflow && !workflow.terminal);
  if (!visible) return null;

  const title = workflow?.currentTitle || workflow?.currentAction || (waiting ? labels.waiting : labels.running);

  return (
    <section className={"thread-progress " + (waiting ? "waiting" : running ? "running" : "")}>
      <div className="thread-progress-head">
        <span>
          {waiting
            ? <ShieldCheck size={13} strokeWidth={1.8} aria-hidden />
            : <ListChecks size={13} strokeWidth={1.7} aria-hidden />}
          <strong>{labels.plan}</strong>
        </span>
        <span className="thread-progress-state">
          <CircleDot size={10} strokeWidth={1.8} aria-hidden />
          {waiting ? labels.waiting : labels.running}
        </span>
      </div>
      <div className="thread-progress-action">{title}</div>
      <div className="thread-progress-meta">
        {workflow?.status && <span>{workflow.status}</span>}
        {activeSubagents > 0 && (
          <span><Bot size={10} strokeWidth={1.7} aria-hidden /> {activeSubagents} {labels.subagents}</span>
        )}
      </div>
      {running && <div className="thread-progress-bar"><span /></div>}
    </section>
  );
}
