import { useEffect, useState, type FormEvent } from "react";
import { presentError } from "../../lib/error-presentation";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { RuntimeEvent, TaskObligation, TaskReference, TaskResolutionState } from "../../types";
import { useTaskState } from "./useTaskState";

export type TaskStateLabels = Pick<
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
  | "taskPendingEdits"
  | "taskEvidenceError"
  | "taskContext"
  | "taskWindowStart"
  | "taskWindowFull"
  | "taskResetContext"
  | "taskResetContextHint"
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
  | "errNoFingerprint"
  | "errUnknownCheck"
>;

type Props = {
  sessionId: string;
  running: boolean;
  events: RuntimeEvent[];
  labels: TaskStateLabels;
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
    case "work_units":
      return labels.taskObligationWorkUnits;
    case "gate":
      return labels.taskObligationGate;
    case "workflow":
      return labels.taskObligationWorkflow;
    case "pending_application":
      return labels.taskObligationPendingApplication;
    case "checks":
      return labels.taskObligationChecks;
    default:
      return obligation;
  }
}

function referenceStateLabel(labels: TaskStateLabels, state: string): string {
  if (state === "included") return labels.taskReferenceIncluded;
  if (state === "excluded") return labels.taskReferenceExcluded;
  if (state === "suggested") return labels.taskReferenceSuggested;
  return state;
}

// TaskStatePanel is the user's control over the thread's Task State (design §7, ADR-0006): the brief
// the agent works toward, the context references it should read, the thread's resolution, and the
// context reset. Core owns every rule; the panel shows Core's view and sends one edit at a time.
export function TaskStatePanel({ sessionId, running, events, labels }: Props) {
  const { info, error, busy, setBrief, editReference, resolve, resetContext } = useTaskState({ sessionId, events });
  const brief = info?.state.brief ?? "";
  const [draft, setDraft] = useState(brief);
  const [newPath, setNewPath] = useState("");

  useEffect(() => setDraft(brief), [brief, sessionId]);

  if (!sessionId) return <div className="inspector-empty">{labels.taskNoSession}</div>;

  const resolution = info?.state.resolution;
  const references: TaskReference[] = info?.state.references ?? [];
  const obligations = info?.obligations ?? [];
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

  return (
    <div className="run-settings task-state">
      <div className="settings-group">
        <div className="settings-title">{labels.taskResolution}</div>
        <div className="task-resolution" role="radiogroup" aria-label={labels.taskResolution}>
          {resolutions.map((state) => (
            <button
              key={state}
              type="button"
              role="radio"
              aria-checked={resolution?.state === state}
              className={resolution?.state === state ? "active" : ""}
              disabled={busy || !info || resolution?.state === state}
              onClick={() => void resolve(state)}
            >
              {resolutionLabel(labels, state)}
            </button>
          ))}
        </div>
        {resolution && resolvedByLabel(labels, resolution.by) && (
          <p className="settings-note">{resolvedByLabel(labels, resolution.by)}</p>
        )}
        {info?.readyForReview && <p className="task-ready">{labels.taskReadyForReview}</p>}
        {resolution?.state === "open" && obligations.length > 0 && (
          <div className="task-obligations">
            <span>{labels.taskObligations}</span>
            <ul>
              {obligations.map((obligation) => (
                <li key={obligation}>{obligationLabel(labels, obligation)}</li>
              ))}
            </ul>
          </div>
        )}
        {info?.evidenceError && (
          <p className="settings-note">{labels.taskEvidenceError.replace("{error}", info.evidenceError)}</p>
        )}
        {(info?.pendingEdits ?? 0) > 0 && (
          <p className="settings-note task-pending">{labels.taskPendingEdits.replace("{count}", String(info?.pendingEdits))}</p>
        )}
      </div>

      <form className="settings-group" onSubmit={saveBrief}>
        <div className="settings-title">{labels.taskBrief}</div>
        <textarea
          className="task-brief"
          aria-label={labels.taskBrief}
          value={draft}
          rows={4}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!info}
        />
        <button className="secondary-action" disabled={busy || !info || draft.trim() === brief}>
          {labels.taskBriefSave}
        </button>
        <p className="settings-note">{labels.taskBriefHint}</p>
      </form>

      <div className="settings-group">
        <div className="settings-title">{labels.taskReferences}</div>
        {references.length === 0 ? (
          <p className="settings-note">{labels.taskReferencesEmpty}</p>
        ) : (
          <ul className="task-references">
            {references.map((ref) => (
              <li key={ref.id} className={`task-reference ${ref.state}`}>
                <div>
                  <code title={ref.target}>{ref.target}</code>
                  <span className="task-reference-state">{referenceStateLabel(labels, ref.state)}</span>
                </div>
                {ref.note && <p>{ref.note}</p>}
                <div className="task-reference-actions">
                  {ref.state !== "included" && (
                    <button type="button" disabled={busy} onClick={() => setReference(ref, "included")}>
                      {labels.taskReferenceInclude}
                    </button>
                  )}
                  {ref.state !== "excluded" && (
                    <button type="button" disabled={busy} onClick={() => setReference(ref, "excluded")}>
                      {labels.taskReferenceExclude}
                    </button>
                  )}
                  <button type="button" disabled={busy} onClick={() => setReference(ref, "removed")}>
                    {labels.taskReferenceRemove}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form className="task-reference-add" onSubmit={addPath}>
          <input
            aria-label={labels.taskReferenceAdd}
            placeholder={labels.taskReferencePlaceholder}
            value={newPath}
            onChange={(event) => setNewPath(event.target.value)}
            disabled={!info}
          />
          <button className="secondary-action" disabled={busy || !info || !newPath.trim()}>
            {labels.taskReferenceAdd}
          </button>
        </form>
      </div>

      <div className="settings-group">
        <div className="settings-title">{labels.taskContext}</div>
        <p className="settings-note">
          {windowStart > 0 ? labels.taskWindowStart.replace("{seq}", String(windowStart)) : labels.taskWindowFull}
        </p>
        <button
          type="button"
          className="secondary-action"
          disabled={busy || !info || running}
          onClick={() => void resetContext()}
        >
          {labels.taskResetContext}
        </button>
        <p className="settings-note">{labels.taskResetContextHint}</p>
      </div>

      {error && (
        <p className="task-error" role="alert">
          {presentError(labels, error)}
        </p>
      )}
    </div>
  );
}
