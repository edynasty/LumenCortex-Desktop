import { useCallback, useEffect, useRef, useState } from "react";
import { bridge } from "../../lib/bridge";
import { presentError } from "../../lib/error-presentation";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { worktreeCleanupChoices, type WorktreeCleanupChoice, type WorktreeCleanupMode } from "../../lib/worktree-cleanup";
import type { SessionDependent, WorktreeInspection, WorktreeRefusal } from "../../types";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { Dialog } from "../primitives/Dialog";
import "./worktree-cleanup.css";

export type WorktreeCleanupTarget = { mode: WorktreeCleanupMode; sessionId: string };

type Props = {
  target: WorktreeCleanupTarget | null;
  labels: AppCopy;
  onClose: () => void;
  // Called after Core removed the worktree or deleted the session. deletedSessionIds
  // lists the session and its deleted subagents for a deletion, and is empty otherwise.
  onCompleted: (deletedSessionIds: string[]) => void;
};

const choiceLabel: Record<WorktreeCleanupMode, Record<WorktreeCleanupChoice["kind"] | "detach" | "retain", keyof AppCopy>> = {
  remove: {
    default: "worktreeRemoveSafe",
    detach: "worktreeDetach",
    retain: "worktreeRetain",
    keepBranch: "worktreeKeepBranch",
    discard: "worktreeDiscard",
  },
  delete: {
    default: "deleteSessionSafe",
    detach: "deleteSessionSafe",
    retain: "deleteSessionRetain",
    keepBranch: "deleteSessionKeepBranch",
    discard: "deleteSessionDiscard",
  },
};

const dependentReason: Record<SessionDependent["reason"], keyof AppCopy> = {
  running: "dependentRunning",
  owns_worktree: "dependentOwnsWorktree",
  uncertain_worktree: "dependentUncertainWorktree",
  independent: "dependentIndependent",
};

// Removing a worktree and deleting a session both show Core's inspection first and
// offer only what it allows (ADR-0005). Core decides again under its exclusive lease:
// a refusal replaces the shown state with Core's fresh inspection, so the user always
// chooses against what is actually on disk.
export function WorktreeCleanupDialog({ target, labels, onClose, onCompleted }: Props) {
  const [inspection, setInspection] = useState<WorktreeInspection | null>(null);
  const [refusal, setRefusal] = useState<WorktreeRefusal | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionId = target?.sessionId;

  useEffect(() => {
    setInspection(null);
    setRefusal(null);
    setError("");
    if (!sessionId) return;
    let cancelled = false;
    bridge.inspectSessionWorktree(sessionId).then(
      (value) => !cancelled && setInspection(value),
      (err) => !cancelled && setError(String(err)),
    );
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Dialog re-runs its focus trap when onOpenChange changes identity, and parents pass
  // a fresh onClose on every render; route through a ref so focus stays put.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const onOpenChange = useCallback((open: boolean) => {
    if (!open) closeRef.current();
  }, []);

  if (!target) return null;
  const { mode } = target;

  async function run(choice: WorktreeCleanupChoice) {
    if (!target) return;
    setBusy(true);
    setError("");
    setRefusal(null);
    try {
      if (target.mode === "delete") {
        const outcome = await bridge.deleteSession(target.sessionId, choice.cleanup);
        if (outcome.refusal) return refused(outcome.refusal);
        onCompleted([target.sessionId, ...(outcome.result?.deletedChildren ?? [])]);
      } else {
        const outcome = await bridge.removeSessionWorktree(target.sessionId, choice.cleanup);
        if (outcome.refusal) return refused(outcome.refusal);
        onCompleted([]);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  function refused(value: WorktreeRefusal) {
    setRefusal(value);
    if (value.inspection) setInspection(value.inspection);
  }

  const role = inspection?.role || "";
  const choices = inspection ? worktreeCleanupChoices(inspection, mode) : [];
  const refusalText = refusal
    ? refusal.code === "busy"
      ? labels.errWorktreeBusy
      : refusal.code === "runHeld"
        ? labels.worktreeRefusalRunHeld
        : refusal.code === "dependents"
          ? labels.worktreeRefusalDependents
          : labels.worktreeRefusalChanged
    : "";

  return (
    <Dialog
      open
      title={mode === "delete" ? labels.deleteSessionTitle : labels.removeWorktreeTitle}
      description={mode === "delete" ? labels.deleteSessionBody : labels.removeWorktreeBody}
      closeLabel={labels.close}
      onOpenChange={onOpenChange}
      footer={
        <>
          <Button onClick={onClose}>{labels.cancel}</Button>
          {choices.map((choice) => {
            const kind = choice.kind === "default" && role === "borrower"
              ? "detach"
              : choice.kind === "keepBranch" && role === "uncertain" ? "retain" : choice.kind;
            return (
              <Button
                key={choice.kind}
                variant={choice.kind === "discard" ? "danger" : "secondary"}
                disabled={busy}
                onClick={() => void run(choice)}
              >
                {labels[choiceLabel[mode][kind]] as string}
              </Button>
            );
          })}
        </>
      }
    >
      <div className="worktree-cleanup">
        {!inspection && !error && <p className="worktree-cleanup-note">{labels.worktreeChecking}</p>}
        {inspection && <InspectionSummary inspection={inspection} labels={labels} />}
        {refusalText && (
          <div className="worktree-cleanup-refusal" role="alert">
            <Icon name="failed" size={14} />
            <div>
              <p>{refusalText}</p>
              {refusal?.dependents && (
                <ul>
                  {refusal.dependents.map((dependent) => (
                    <li key={dependent.sessionId}>
                      <code>{dependent.sessionId}</code> {labels[dependentReason[dependent.reason]] as string}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        {error && (
          <div className="worktree-cleanup-refusal" role="alert">
            <Icon name="failed" size={14} />
            <p>{presentError(labels, error)}</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function InspectionSummary({ inspection, labels }: { inspection: WorktreeInspection; labels: AppCopy }) {
  const role = inspection.role || "";
  if (role === "") return <p className="worktree-cleanup-note">{labels.worktreeNone}</p>;

  const dirty = inspection.dirtyFiles ?? [];
  const commits = inspection.unappliedCommits ?? [];
  const ignored = inspection.ignoredFiles ?? [];
  const atRisk = dirty.length + commits.length + ignored.length > 0;
  return (
    <>
      <dl className="worktree-cleanup-identity">
        {inspection.branch && (<><dt>{labels.worktreeRuntime}</dt><dd><code>{inspection.branch}</code></dd></>)}
        {inspection.path && (<><dt /><dd><code title={inspection.path}>{inspection.path}</code></dd></>)}
      </dl>
      {role === "borrower" && <p className="worktree-cleanup-note">{labels.worktreeBorrowed}</p>}
      {role === "uncertain" && (
        <p className="worktree-cleanup-note warning">{labels.worktreeUncertain} {inspection.uncertain}</p>
      )}
      {role === "owner" && !inspection.exists && <p className="worktree-cleanup-note">{labels.worktreeMissing}</p>}
      {role === "owner" && !atRisk && <p className="worktree-cleanup-note safe">{labels.worktreeNothingAtRisk}</p>}
      {role === "owner" && (
        <>
          <RiskList title={labels.worktreeDirtyFiles} items={dirty} />
          <RiskList title={labels.worktreeUnappliedCommits} items={commits.map((commit) => commit.slice(0, 10))} />
          <RiskList
            title={labels.worktreeIgnoredFiles}
            items={ignored}
            note={inspection.ignoredTruncated ? labels.worktreeListTruncated : undefined}
          />
        </>
      )}
    </>
  );
}

const shownItems = 8;

function RiskList({ title, items, note }: { title: string; items: string[]; note?: string }) {
  if (!items.length) return null;
  return (
    <section className="worktree-cleanup-risk">
      <h3>{title} <span>{items.length}</span></h3>
      <div className="worktree-cleanup-items">
        {items.slice(0, shownItems).map((item) => <code key={item}>{item}</code>)}
        {items.length > shownItems && <span>+{items.length - shownItems}</span>}
      </div>
      {note && <p className="worktree-cleanup-note">{note}</p>}
    </section>
  );
}
