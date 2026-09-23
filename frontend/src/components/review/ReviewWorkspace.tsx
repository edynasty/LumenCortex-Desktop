import { useEffect, useMemo, useState } from "react";
import type { Message, SessionRuntime } from "../../types";
import { GitBranch, MessageSquareText, RotateCcw, Upload } from "lucide-react";
import { languageFromPath } from "../../lib/syntax";
import { RuntimeIdentity } from "../runtime/RuntimeIdentity";
import { Button } from "../primitives/Button";
import { Dialog } from "../primitives/Dialog";
import { EmptyState } from "../primitives/EmptyState";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { CheckSummary } from "./CheckSummary";
import { extractCheckResults } from "./checks";
import { diffStats, parseUnifiedDiff, splitDiffRows } from "./diff";
import { ReviewDiffViewer } from "./ReviewDiffViewer";
import { useReviewState, type DiffScope } from "./useReviewState";
import { WorktreeHandoffCard } from "./WorktreeHandoffCard";
import { useWorktreeHandoff } from "./useWorktreeHandoff";
import "./review.css";

type Props = {
  sessionId: string;
  runtime: SessionRuntime;
  messages: Message[];
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
    checkPassed: string;
    checkFailed: string;
    checkTruncated: string;
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

function statusLabel(index: string, worktree: string) {
  if (index === "?" && worktree === "?") return "U";
  if (index !== " " && index !== "?") return index;
  return worktree === " " ? "M" : worktree;
}

function useSplitDiffAvailable() {
  const query = "(min-width: 1025px)";
  const [available, setAvailable] = useState(() =>
    typeof window === "undefined" || typeof window.matchMedia !== "function"
      ? true
      : window.matchMedia(query).matches
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const media = window.matchMedia(query);
    const sync = () => setAvailable(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return available;
}

export function ReviewWorkspace({ sessionId, runtime, messages, agentBusy, agentRunning, onSendInstruction, labels }: Props) {
  const review = useReviewState(sessionId);
  const [mode, setMode] = useState<"unified" | "split">("unified");
  const splitDiffAvailable = useSplitDiffAvailable();
  const [revertOpen, setRevertOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [instruction, setInstruction] = useState("");
  const lines = useMemo(() => parseUnifiedDiff(review.diff.content), [review.diff.content]);
  const rows = useMemo(() => splitDiffRows(lines), [lines]);
  const stats = useMemo(() => diffStats(lines), [lines]);
  const checks = useMemo(() => extractCheckResults(messages), [messages]);
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

  const handoff = useWorktreeHandoff({
    sessionId,
    runtimeKind: runtime.kind,
    revision: review.revision,
    agentRunning,
    appliedLabel: labels.handoffApplied,
    onAfterApply: review.refresh,
  });

  return (
    <section className="review-workspace">
      <aside className="review-files">
        <div className="review-files-head">
          <strong>{labels.changedFiles}</strong>
          <span>{review.status.files.length}</span>
        </div>
        <div className="review-file-list">
          {review.status.files.map((file) => (
            <button
              type="button"
              key={file.path}
              className={file.path === review.selectedPath ? "selected" : ""}
              onClick={() => review.setSelectedPath(file.path)}
            >
              <span className="review-file-status">{statusLabel(file.index, file.worktree)}</span>
              <span>{file.path}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="review-main">
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
          <EmptyState icon={<GitBranch size={22} />} title={labels.noChanges} />
        ) : (
          <>
            <header className="review-toolbar">
              <div className="review-file-title">
                <strong>{review.selectedPath || labels.title}</strong>
                <span>+{stats.additions} −{stats.deletions}</span>
                <RuntimeIdentity
                  runtime={runtime}
                  localLabel={labels.localRuntime}
                  worktreeLabel={labels.worktreeRuntime}
                />
              </div>
              <div className="review-toolbar-actions">
                <SegmentedControl<DiffScope>
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
                    value={mode}
                    ariaLabel="Diff layout"
                    options={[
                      { value: "unified", label: labels.unified },
                      { value: "split", label: labels.split },
                    ]}
                    onChange={setMode}
                  />
                )}
                {canStage && <Button onClick={() => void review.stage()} disabled={review.actionBusy}>{labels.stage}</Button>}
                {canUnstage && <Button onClick={() => void review.unstage()} disabled={review.actionBusy}>{labels.unstage}</Button>}
                <Button variant="danger" icon={<RotateCcw size={12} />} disabled={!review.selectedPath || review.actionBusy} onClick={() => setRevertOpen(true)}>
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

            <CheckSummary
              results={checks}
              labels={{
                checks: labels.checks,
                passed: labels.checkPassed,
                failed: labels.checkFailed,
                truncated: labels.checkTruncated,
              }}
            />

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
      </div>

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
