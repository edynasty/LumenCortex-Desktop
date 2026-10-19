import type { AppCopy } from "../../lib/i18n/app-copy";
import type { TaskResult } from "../../types";
import { Icon } from "../primitives/Icon";
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

// A task_result row (Lumen Glass result block): Core's report of one terminal transition of an
// execution task, delivered at the parent's Start. It is the runtime's record, not a message
// from the user or the model.
export function TaskResultNotice({ result, labels, onOpen }: Props) {
  return (
    <article
      className={`block task-result-block tone-${result.status}`}
      role="note"
      aria-label={`${labels.runtimeNotice}: ${labels.originTaskResult}`}
    >
      <header className="block-head">
        <Icon name="inbox" size={16} className="block-icon" />
        <span className="block-kicker">{labels.originTaskResult}</span>
        <h3 className="task-objective">{result.objective}</h3>
        <span className="toolbar-spacer" />
        <span className={`task-state tone-${result.status}`}>{statusLabel(labels, result.status)}</span>
      </header>
      {result.final && <p className="block-text">{result.final}</p>}
      {result.error && <pre className="block-code">{result.error}</pre>}
      <div className="task-meta">
        <ResultFacts result={result} labels={labels} />
        {result.sessionId && (
          <button
            type="button"
            className="link-btn"
            onClick={() => onOpen(result.sessionId)}
          >
            {labels.taskOpen}
          </button>
        )}
      </div>
    </article>
  );
}
