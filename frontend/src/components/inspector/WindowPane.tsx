import type { AppCopy } from "../../lib/i18n/app-copy";
import type { Health, RuntimeEvent, SessionCheckpoint } from "../../types";
import { InspectorRow, InspectorSection } from "./Section";
import { TaskStatePanel } from "./TaskStatePanel";

const CHECKPOINTS_SHOWN = 10;

function bytes(value = 0) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

type Props = {
  sessionId: string;
  running: boolean;
  events: RuntimeEvent[];
  health?: Health;
  pressure: number;
  checkpoints: SessionCheckpoint[];
  labels: AppCopy;
};

// The Window pane: what the thread keeps in view — the context window and its reset (Task State),
// the runtime's working memory with its pressure, and the session's recent checkpoints.
export function WindowPane({ sessionId, running, events, health, pressure, checkpoints, labels }: Props) {
  const recent = checkpoints.slice(-CHECKPOINTS_SHOWN).reverse();
  return (
    <div className="tp-pane">
      <TaskStatePanel pane="window" sessionId={sessionId} running={running} events={events} labels={labels} />

      <InspectorSection title={labels.runtime}>
        <InspectorRow label={labels.workingMemory} mono>{bytes(health?.usedBytes)}</InspectorRow>
        <InspectorRow label={labels.softBudget} mono>{bytes(health?.budget.softBytes)}</InspectorRow>
        <InspectorRow label={labels.hardBudget} mono>{bytes(health?.budget.hardBytes)}</InspectorRow>
        <InspectorRow label={labels.maxAgents}>{health?.budget.maxAgents ?? "—"}</InspectorRow>
        <div
          className="memory-meter"
          role="progressbar"
          aria-label={labels.workingMemory}
          aria-valuenow={Math.round(Math.min(100, Math.max(0, pressure)))}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${Math.min(100, Math.max(0, pressure))}%` }} />
        </div>
      </InspectorSection>

      <InspectorSection
        title={labels.inspectorCheckpoints}
        badge={recent.length > 0 && <span className="tp-pane-count">{recent.length}</span>}
      >
        {recent.length === 0 ? (
          <p className="tp-pane-muted">{labels.inspectorNoCheckpoints}</p>
        ) : (
          <ol className="checkpoint-list">
            {recent.map((item) => (
              <li key={`${item.sessionId}:${item.seq}`}>
                <span className="num">#{item.seq}</span>
                <span className="mono">{item.reason}</span>
                <span className="tp-pane-muted">
                  {new Date(item.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </InspectorSection>
    </div>
  );
}
