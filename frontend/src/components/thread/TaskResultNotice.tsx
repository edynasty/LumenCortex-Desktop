import { SquareArrowOutUpRight } from "lucide-react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { TaskResult } from "../../types";
import { ResultFacts, type ExecutionTaskLabels } from "./ExecutionTasks";

type Props = {
  seq: number;
  result: TaskResult;
  labels: ExecutionTaskLabels & Pick<AppCopy, "originTaskResult" | "runtimeNotice">;
  onOpen: (sessionId: string) => void;
};

function statusLabel(labels: Props["labels"], status: string): string {
  switch (status) {
    case "completed": return labels.taskFinished;
    case "interrupted": return labels.taskInterrupted;
    case "failed": return labels.taskFailed;
    case "waiting_gate": return labels.taskWaitingGate;
    default: return status;
  }
}

// A task_result row: Core's report of one terminal transition of an execution task, delivered at the
// parent's Start. It is the runtime's record, not a message from the user or the model.
export function TaskResultNotice({ seq, result, labels, onOpen }: Props) {
  return (
    <article
      className={`message-row notice task-result status-${result.status}`}
      role="note"
      aria-label={`${labels.runtimeNotice}: ${labels.originTaskResult}`}
    >
      <div className="message-avatar" aria-hidden>RT</div>
      <div className="message-body">
        <div className="message-head">
          <strong>{labels.originTaskResult}</strong>
          <div className="message-head-actions">
            <button
              type="button"
              aria-label={`${labels.taskOpen}: ${result.objective}`}
              title={labels.taskOpen}
              onClick={() => onOpen(result.sessionId)}
            >
              <SquareArrowOutUpRight size={11} strokeWidth={1.8} aria-hidden />
            </button>
            <span>#{seq}</span>
          </div>
        </div>
        <p className="task-result-objective">{result.objective}</p>
        <div className="task-row-meta">
          <span className="task-phase">{statusLabel(labels, result.status)}</span>
          <ResultFacts result={result} labels={labels} />
        </div>
        {result.error && <p className="task-row-error">{result.error}</p>}
        {result.final && <p className="task-result-final">{result.final}</p>}
      </div>
    </article>
  );
}
