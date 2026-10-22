import { useEffect, useState, type FormEvent } from "react";
import { PathLabel } from "../primitives/PathLabel";
import { presentError } from "../../lib/error-presentation";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { RuntimeEvent, TaskObligation, TaskReference, TaskResolutionState, ThreadTask } from "../../types";
import { EmptyState } from "../primitives/EmptyState";
import { Icon } from "../primitives/Icon";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { NotesSection, type NotesLabels } from "./NotesSection";
import { InspectorSection } from "./Section";
import { useTaskState } from "./useTaskState";

export type TaskStateLabels = NotesLabels & Pick<
  AppCopy,
  | "taskNoSession"
  | "taskBrief"
  | "taskBriefHint"
  | "taskBriefSave"
  | "taskReferences"
  | "taskReferencesEmpty"
  | "taskReferenceAdd"
  | "taskReferencePlaceholder"
  | "taskReferenceIncluded"
  | "taskReferenceExcluded"
  | "taskReferenceSuggested"
  | "taskReferenceInclude"
  | "taskReferenceExclude"
  | "taskReferenceRemove"
  | "taskResolution"
  | "taskResolutionOpen"
  | "taskResolutionDone"
  | "taskResolutionDropped"
  | "taskResolvedByUser"
  | "taskResolvedByEvidence"
  | "taskResolvedByReopen"
  | "taskReadyForReview"
  | "taskObligations"
  | "taskObligationWorkUnits"
  | "taskObligationGate"
  | "taskObligationWorkflow"
  | "taskObligationPendingApplication"
  | "taskObligationChecks"
  | "taskObligationTasks"
  | "taskPendingEdits"
  | "taskEvidenceError"
  | "taskContext"
  | "taskWindowStart"
  | "taskWindowFull"
  | "taskResetContext"
  | "taskResetContextHint"
  | "tasksTitle"
  | "taskProposed"
  | "taskStarted"
  | "runningElsewhereError"
  | "errWorktreeBusy"
  | "errDatabaseInUse"
  | "errSchemaTooNew"
  | "errLegacyNodeDatabase"
  | "errUnknownModel"
  | "errModelWithoutToolCalling"
  | "errInvalidEffort"
  | "errConflict"
  | "errInvalidConfig"
  | "errSubagentModelRetired"
  | "errUnknownAgent"
  | "errAgentNotForConversation"
  | "errAgentUseMismatch"
  | "errNoFingerprint"
  | "errUnknownCheck"
  | "errTaskProposalNotFound"
  | "errTaskProposalStarted"
  | "errTaskNeedsCommit"
  | "errChildLimit"
  | "errAgentLimit"
  | "errTooManyNotes"
  | "errUntrustedWorkspace"
>;

type Props = {
  sessionId: string;
  running: boolean;
  events: RuntimeEvent[];
  labels: TaskStateLabels;
  /** "task" = brief, references, resolution, obligations, execution tasks; "window" = context window + reset. */
  pane?: "task" | "window";
  /** Opens an execution task's own session (the Run pane's subagent tree uses the same callback). */
  onOpenTask?: (sessionId: string) => void;
};

const resolutions: TaskResolutionState[] = ["open", "done", "dropped"];

function resolutionLabel(labels: TaskStateLabels, state: string): string {
  if (state === "done") return labels.taskResolutionDone;
  if (state === "dropped") return labels.taskResolutionDropped;
  return labels.taskResolutionOpen;
}

function resolvedByLabel(labels: TaskStateLabels, by?: string): string {
  if (by === "user") return labels.taskResolvedByUser;
  if (by === "evidence") return labels.taskResolvedByEvidence;
  if (by === "reopen") return labels.taskResolvedByReopen;
  return "";
}

function obligationLabel(labels: TaskStateLabels, obligation: TaskObligation): string {
  switch (obligation) {
    case "work_units": return labels.taskObligationWorkUnits;
    case "gate": return labels.taskObligationGate;
    case "workflow": return labels.taskObligationWorkflow;
    case "pending_application": return labels.taskObligationPendingApplication;
    case "checks": return labels.taskObligationChecks;
    case "tasks": return labels.taskObligationTasks;
    default: return obligation;
  }
}

function referenceStateLabel(labels: TaskStateLabels, state: string): string {
  if (state === "included") return labels.taskReferenceIncluded;
  if (state === "excluded") return labels.taskReferenceExcluded;
  if (state === "suggested") return labels.taskReferenceSuggested;
  return state;
}

function taskStateLabel(labels: TaskStateLabels, state: string): string {
  if (state === "proposed") return labels.taskProposed;
  if (state === "started") return labels.taskStarted;
  return state;
}


// TaskStatePanel is the user's control over the thread's Task State (design §7, ADR-0006): the brief
// the agent works toward, the context references it should read, the thread's resolution, and the
// context reset. Core owns every rule; the panel shows Core's view and sends one edit at a time.
export function TaskStatePanel({ sessionId, running, events, labels, pane = "task", onOpenTask }: Props) {
  const { info, error, busy, setBrief, editReference, editNote, resolve, resetContext } = useTaskState({ sessionId, events });
  const brief = info?.state.brief ?? "";
  const [draft, setDraft] = useState(brief);
  const [newPath, setNewPath] = useState("");

  useEffect(() => setDraft(brief), [brief, sessionId]);

  if (!sessionId) return <EmptyState compact icon={<Icon name="discussion" size={18} />} title={labels.taskNoSession} />;

  const resolution = info?.state.resolution;
  const references: TaskReference[] = info?.state.references ?? [];
  const obligations = info?.obligations ?? [];
  const tasks: ThreadTask[] = info?.state.tasks ?? [];
  const windowStart = info?.state.windowStartSeq ?? 0;

  const saveBrief = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void setBrief(draft.trim());
  };
  const addPath = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = newPath.trim();
    if (!target) return;
    if (await editReference({ kind: "path", target, state: "included" })) setNewPath("");
  };
  const setReference = (ref: TaskReference, state: "included" | "excluded" | "removed") =>
    void editReference({ kind: ref.kind === "thread" ? "thread" : "path", target: ref.target, state });

  if (pane === "window") {
    return (
      <>
        <InspectorSection title={labels.taskContext}>
          <p className="tp-pane-muted">
            {windowStart > 0 ? labels.taskWindowStart.replace("{seq}", String(windowStart)) : labels.taskWindowFull}
          </p>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={busy || !info || running}
            onClick={() => void resetContext()}
          >
            {labels.taskResetContext}
          </button>
          <p className="tp-pane-muted">{labels.taskResetContextHint}</p>
        </InspectorSection>
        {error && (
          <p className="tp-pane-error" role="alert">
            {presentError(labels, error)}
          </p>
        )}
      </>
    );
  }

  return (
    <>
      {(info?.pendingEdits ?? 0) > 0 && (
        <div className="tp-pane-inbox" role="status">
          <Icon name="inbox" size={14} />
          <div>
            <strong>{labels.taskPendingEdits.replace("{count}", String(info?.pendingEdits))}</strong>
          </div>
        </div>
      )}

      <InspectorSection title={labels.taskBrief}>
        <form className="brief-edit" onSubmit={saveBrief}>
          <textarea
            aria-label={labels.taskBrief}
            value={draft}
            rows={4}
            onChange={(event) => setDraft(event.target.value)}
            disabled={!info}
          />
          <div className="brief-edit-actions">
            <span className="tp-pane-muted">{labels.taskBriefHint}</span>
            <button className="btn btn-sm btn-primary" type="submit" disabled={busy || !info || draft.trim() === brief}>
              {labels.taskBriefSave}
            </button>
          </div>
        </form>
      </InspectorSection>

      <InspectorSection
        title={labels.taskReferences}
        badge={references.length > 0 && <span className="tp-pane-count">{references.length}</span>}
      >
        {references.length === 0 ? (
          <p className="tp-pane-muted">{labels.taskReferencesEmpty}</p>
        ) : (
          <ul className="ref-list">
            {references.map((ref) => (
              <li key={ref.id} className={`ref-row state-${ref.state}`}>
                <Icon name={ref.kind === "thread" ? "discussion" : "file"} size={14} className="ref-kind" />
                <div className="ref-main">
                  {ref.kind === "path" ? <PathLabel path={ref.target} /> : <span className="ref-name">{ref.target}</span>}
                  <span className="ref-meta">
                    {referenceStateLabel(labels, ref.state)}
                    {ref.note ? ` · ${ref.note}` : ""}
                  </span>
                </div>
                <span className="ref-actions">
                  {ref.state !== "included" && (
                    <button type="button" className="link-btn" disabled={busy} onClick={() => setReference(ref, "included")}>
                      {labels.taskReferenceInclude}
                    </button>
                  )}
                  {ref.state !== "excluded" && (
                    <button type="button" className="link-btn" disabled={busy} onClick={() => setReference(ref, "excluded")}>
                      {labels.taskReferenceExclude}
                    </button>
                  )}
                  <button type="button" className="link-btn is-danger" disabled={busy} onClick={() => setReference(ref, "removed")}>
                    {labels.taskReferenceRemove}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <form className="ref-add" onSubmit={addPath}>
          <input
            className="input mono"
            aria-label={labels.taskReferenceAdd}
            placeholder={labels.taskReferencePlaceholder}
            value={newPath}
            onChange={(event) => setNewPath(event.target.value)}
            disabled={!info}
          />
          <button className="btn btn-sm btn-secondary" type="submit" disabled={busy || !info || !newPath.trim()}>
            {labels.taskReferenceAdd}
          </button>
        </form>
      </InspectorSection>

      <NotesSection notes={info?.state.notes ?? []} ready={Boolean(info)} busy={busy} labels={labels} editNote={editNote} />

      <InspectorSection title={labels.taskResolution}>
        <SegmentedControl
          ariaLabel={labels.taskResolution}
          value={(resolution?.state ?? "open") as TaskResolutionState}
          options={resolutions.map((state) => ({ value: state, label: resolutionLabel(labels, state) }))}
          onChange={(state) => {
            if (info && !busy && state !== resolution?.state) void resolve(state);
          }}
        />
        {resolution && resolvedByLabel(labels, resolution.by) && (
          <p className="tp-pane-muted">{resolvedByLabel(labels, resolution.by)}</p>
        )}
        {info?.readyForReview && (
          <p className="task-ready">
            <Icon name="review" size={12} />
            {labels.taskReadyForReview}
          </p>
        )}
        {info?.evidenceError && (
          <p className="tp-pane-muted">{labels.taskEvidenceError.replace("{error}", info.evidenceError)}</p>
        )}
      </InspectorSection>

      {resolution?.state === "open" && obligations.length > 0 && (
        <InspectorSection
          title={labels.taskObligations}
          badge={<span className="tp-pane-count">{obligations.length}</span>}
        >
          <ul className="unit-list">
            {obligations.map((obligation) => (
              <li key={obligation} className="unit-row">
                <Icon name="open" size={14} />
                <span>{obligationLabel(labels, obligation)}</span>
              </li>
            ))}
          </ul>
        </InspectorSection>
      )}

      {tasks.length > 0 && (
        <InspectorSection
          title={labels.tasksTitle}
          badge={<span className="tp-pane-count">{tasks.length}</span>}
        >
          <ul className="task-list">
            {tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="task-row"
                  disabled={!task.sessionId || !onOpenTask}
                  onClick={() => task.sessionId && onOpenTask?.(task.sessionId)}
                >
                  <Icon name="task" size={14} />
                  <span className="task-row-title">{task.objective}</span>
                  <span className="tp-pane-muted">{taskStateLabel(labels, task.state)}</span>
                </button>
              </li>
            ))}
          </ul>
        </InspectorSection>
      )}

      {error && (
        <p className="tp-pane-error" role="alert">
          {presentError(labels, error)}
        </p>
      )}
    </>
  );
}
