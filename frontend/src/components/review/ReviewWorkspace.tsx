import { useEffect, useMemo, useState } from "react";
import type { SessionRuntime } from "../../types";
import { MessageSquareText, RotateCcw, Upload } from "lucide-react";
import { languageFromPath } from "../../lib/syntax";
import { RuntimeIdentity } from "../runtime/RuntimeIdentity";
import { Button } from "../primitives/Button";
import { Dialog } from "../primitives/Dialog";
import { Icon } from "../primitives/Icon";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { PathLabel } from "../primitives/PathLabel";
import { CheckSummary } from "./CheckSummary";
import { diffStats, parseUnifiedDiff, splitDiffRows } from "./diff";
import { ReviewDiffViewer, DiffCount, useSplitDiffAvailable } from "./ReviewDiffViewer";
import { statusLabel, useReviewState, type DiffScope } from "./useReviewState";
import { WorktreeHandoffCard } from "./WorktreeHandoffCard";
import { useWorktreeHandoff } from "./useWorktreeHandoff";
import "./review.css";

type Props = {
  sessionId: string;
  runtime: SessionRuntime;
  agentBusy: boolean;
  agentRunning: boolean;
  onSendInstruction: (path: string, instruction: string) => Promise<void> | void;
  labels: {
    title: string;
    changedFiles: string;
    noChanges: string;
    unified: string;
    split: string;
    worktree: string;
    staged: string;
    stage: string;
    unstage: string;
    revert: string;
    revertTitle: string;
    revertBody: string;
    cancel: string;
    commit: string;
    commitPlaceholder: string;
    push: string;
    truncated: string;
    loadMoreDiff: string;
    loading: string;
    binaryDiff: string;
    reviewInstruction: string;
    reviewInstructionPlaceholder: string;
    sendToAgent: string;
    agentRunning: string;
    checks: string;
    checksSatisfied: string;
    checksStatusFailed: string;
    checksStatusError: string;
    checksNeverRun: string;
    checksStale: string;
    localRuntime: string;
    worktreeRuntime: string;
    conflictTitle: string;
    conflictHint: string;
    handoffTitle: string;
    handoffTarget: string;
    handoffCommits: string;
    handoffReady: string;
    handoffSourceDirty: string;
    handoffTargetDirty: string;
    handoffNoCommits: string;
    handoffOverlap: string;
    handoffApply: string;
    handoffRefresh: string;
    handoffConfirmTitle: string;
    handoffConfirmBody: string;
    handoffApplied: string;
  };
};

export function ReviewWorkspace({ sessionId, runtime, agentBusy, agentRunning, onSendInstruction, labels }: Props) {
  const review = useReviewState(sessionId);
  const [mode, setMode] = useState<"unified" | "split">("unified");
  const splitDiffAvailable = useSplitDiffAvailable();
  const [revertOpen, setRevertOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [instruction, setInstruction] = useState("");
  const lines = useMemo(() => parseUnifiedDiff(review.diff.content), [review.diff.content]);
  const rows = useMemo(() => splitDiffRows(lines), [lines]);
  const stats = useMemo(() => diffStats(lines), [lines]);
  const language = useMemo(() => languageFromPath(review.selectedPath), [review.selectedPath]);
  const binaryDiff = /(^|\n)(Binary files .* differ|GIT binary patch)(\n|$)/.test(review.diff.content);
  useEffect(() => {
    if (!splitDiffAvailable && mode === "split") setMode("unified");
  }, [mode, splitDiffAvailable]);

  const relevantConflicts = useMemo(
    () => review.conflicts.filter((conflict) =>
      conflict.owners.some((owner) =>
        runtime.kind === "local"
          ? owner.kind === "local"
          : owner.sessionId === sessionId
      )
    ),
    [review.conflicts, runtime.kind, sessionId]
  );
  const canStage = Boolean(review.selectedFile && (review.selectedFile.worktree !== " " || review.selectedFile.index === "?"));
  const canUnstage = Boolean(review.selectedFile && review.selectedFile.index !== " " && review.selectedFile.index !== "?");
  const selectedStatus = review.selectedFile ? statusLabel(review.selectedFile.index, review.selectedFile.worktree) : "";

  const handoff = useWorktreeHandoff({
    sessionId,
    runtimeKind: runtime.kind,
    revision: review.revision,
    agentRunning,
    appliedLabel: labels.handoffApplied,
    onAfterApply: review.refresh,
  });

  return (
    <section className="changes-view">
      {runtime.kind === "worktree" && (
        <WorktreeHandoffCard
          plan={handoff.plan}
          loading={handoff.loading}
          busy={handoff.busy || agentBusy || agentRunning}
          notice={handoff.notice}
          labels={{
            title: labels.handoffTitle,
            target: labels.handoffTarget,
            commits: labels.handoffCommits,
            ready: labels.handoffReady,
            sourceDirty: labels.handoffSourceDirty,
            targetDirty: labels.handoffTargetDirty,
            noCommits: labels.handoffNoCommits,
            overlap: labels.handoffOverlap,
            apply: labels.handoffApply,
            refresh: labels.handoffRefresh,
            confirmTitle: labels.handoffConfirmTitle,
            confirmBody: labels.handoffConfirmBody,
            cancel: labels.cancel,
            applied: labels.handoffApplied,
          }}
          onRefresh={() => void handoff.refresh()}
          onApply={handoff.apply}
        />
      )}
      {handoff.error && <div className="review-error">{handoff.error}</div>}

      {!review.status.files.length && !review.loading ? (
        <div className="changes-empty">
          <Icon name="changes" size={22} />
          <p>{labels.noChanges}</p>
        </div>
      ) : (
        <>
          <header className="changes-toolbar">
            <span className="changes-summary">
              <span className="changes-summary-text">{labels.changedFiles} · {review.status.files.length}</span>
              <DiffCount added={stats.additions} removed={stats.deletions} />
            </span>
            <RuntimeIdentity
              runtime={runtime}
              localLabel={labels.localRuntime}
              worktreeLabel={labels.worktreeRuntime}
            />
            <span className="toolbar-spacer" />
            <div className="review-toolbar-actions">
              <SegmentedControl<DiffScope>
                size="sm"
                value={review.scope}
                ariaLabel="Diff scope"
                options={[
                  { value: "worktree", label: labels.worktree },
                  { value: "staged", label: labels.staged },
                ]}
                onChange={review.setScope}
              />
              {splitDiffAvailable && (
                <SegmentedControl
                  size="sm"
                  value={mode}
                  ariaLabel="Diff layout"
                  options={[
                    { value: "unified", label: labels.unified },
                    { value: "split", label: labels.split },
                  ]}
                  onChange={setMode}
                />
              )}
              {canStage && <Button size="sm" variant="ghost" onClick={() => void review.stage()} disabled={review.actionBusy}>{labels.stage}</Button>}
              {canUnstage && <Button size="sm" variant="ghost" onClick={() => void review.unstage()} disabled={review.actionBusy}>{labels.unstage}</Button>}
              <Button size="sm" variant="danger" icon={<RotateCcw size={12} />} disabled={!review.selectedPath || review.actionBusy} onClick={() => setRevertOpen(true)}>
                {labels.revert}
              </Button>
            </div>
          </header>

          {review.diff.truncated && <div className="review-warning">{labels.truncated}</div>}
          {review.error && <div className="review-error">{review.error}</div>}
          {review.notice && <div className="review-notice">{review.notice}</div>}
          {relevantConflicts.length > 0 && (
            <div className="review-conflicts">
              <strong>{labels.conflictTitle}</strong>
              <span>{labels.conflictHint}</span>
              <div>
                {relevantConflicts.map((conflict) => (
                  <code key={conflict.path}>{conflict.path}</code>
                ))}
              </div>
            </div>
          )}

          <CheckSummary sessionId={sessionId} revision={review.revision} running={agentRunning} labels={labels} />

          <div className="changes-body">
            <ul className="file-list" role="listbox" aria-label={labels.changedFiles}>
              {review.status.files.map((file) => (
                <li
                  key={file.path}
                  role="option"
                  aria-selected={file.path === review.selectedPath}
                  className={`file-row ${file.path === review.selectedPath ? "is-selected" : ""}`}
                  onClick={() => review.setSelectedPath(file.path)}
                >
                  <span className={`file-status st-${statusLabel(file.index, file.worktree)}`}>
                    {statusLabel(file.index, file.worktree)}
                  </span>
                  <PathLabel path={file.path} />
                </li>
              ))}
            </ul>
            <div className="diff-view">
              <header className="diff-file-head">
                <span className={`file-status st-${selectedStatus}`}>{selectedStatus}</span>
                <PathLabel path={review.selectedPath} />
                <DiffCount added={stats.additions} removed={stats.deletions} />
              </header>
              <ReviewDiffViewer
                loading={review.loading}
                binary={binaryDiff}
                selectedPath={review.selectedPath}
                contentKey={`${review.selectedPath}:${review.scope}:${review.diff.bytes}:${review.revision}`}
                mode={mode}
                lines={lines}
                rows={rows}
                language={language}
                loadingLabel={labels.loading}
                binaryLabel={labels.binaryDiff}
                loadMoreLabel={labels.loadMoreDiff}
              />
            </div>
          </div>

          <section className="review-feedback">
            <div className="review-feedback-label">
              <MessageSquareText size={13} strokeWidth={1.7} aria-hidden />
              <span>{labels.reviewInstruction}</span>
            </div>
            <textarea
              rows={2}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder={labels.reviewInstructionPlaceholder}
              disabled={agentBusy || agentRunning || !review.selectedPath}
            />
            <Button
              variant="primary"
              disabled={agentBusy || agentRunning || !review.selectedPath || !instruction.trim()}
              onClick={async () => {
                const value = instruction.trim();
                if (!value) return;
                await onSendInstruction(review.selectedPath, value);
                setInstruction("");
              }}
            >
              {agentRunning ? labels.agentRunning : labels.sendToAgent}
            </Button>
          </section>

          <footer className="review-footer">
            <input
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              placeholder={labels.commitPlaceholder}
              aria-label={labels.commitPlaceholder}
            />
            <Button
              variant="primary"
              disabled={!commitMessage.trim() || review.actionBusy}
              onClick={() => {
                void review.commit(commitMessage.trim());
                setCommitMessage("");
              }}
            >
              {labels.commit}
            </Button>
            <Button icon={<Upload size={12} />} disabled={review.actionBusy} onClick={() => void review.push()}>
              {labels.push}
            </Button>
          </footer>
        </>
      )}

      <Dialog
        open={revertOpen}
        title={labels.revertTitle}
        description={labels.revertBody}
        closeLabel={labels.cancel}
        onOpenChange={setRevertOpen}
        footer={
          <>
            <Button onClick={() => setRevertOpen(false)}>{labels.cancel}</Button>
            <Button
              variant="danger"
              onClick={() => {
                setRevertOpen(false);
                void review.revert();
              }}
            >
              {labels.revert}
            </Button>
          </>
        }
      />
    </section>
  );
}
