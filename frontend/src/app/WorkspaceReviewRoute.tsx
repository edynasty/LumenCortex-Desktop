import { ReviewWorkspace } from "../components/review/ReviewWorkspace";
import type { AppCopy } from "../lib/i18n/app-copy";
import type { Session, SessionRuntime } from "../types";

type Props = {
  session: Session;
  runtime: SessionRuntime;
  busy: boolean;
  running: boolean;
  labels: AppCopy;
  onSendInstruction: (path: string, instruction: string) => Promise<void>;
};

export function WorkspaceReviewRoute({
  session,
  runtime,
  busy,
  running,
  labels,
  onSendInstruction,
}: Props) {
  return (
    <ReviewWorkspace
      sessionId={session.id}
      runtime={runtime}
      agentBusy={busy}
      agentRunning={running}
      onSendInstruction={onSendInstruction}
      labels={{
        title: labels.review,
        changedFiles: labels.changedFiles,
        noChanges: labels.noChanges,
        unified: labels.unified,
        split: labels.split,
        worktree: labels.worktree,
        staged: labels.staged,
        stage: labels.stage,
        unstage: labels.unstage,
        revert: labels.revert,
        revertTitle: labels.revertTitle,
        revertBody: labels.revertBody,
        cancel: labels.cancel,
        commit: labels.commit,
        commitPlaceholder: labels.commitPlaceholder,
        push: labels.push,
        truncated: labels.diffTruncated,
        loadMoreDiff: labels.loadMoreDiff,
        loading: labels.loading,
        binaryDiff: labels.binaryDiff,
        reviewInstruction: labels.reviewInstruction,
        reviewInstructionPlaceholder: labels.reviewInstructionPlaceholder,
        sendToAgent: labels.sendToAgent,
        agentRunning: labels.agentRunning,
        checks: labels.checks,
        checksSatisfied: labels.checksSatisfied,
        checksStatusFailed: labels.checksStatusFailed,
        checksStatusError: labels.checksStatusError,
        checksNeverRun: labels.checksNeverRun,
        checksStale: labels.checksStale,
        localRuntime: labels.localRuntime,
        worktreeRuntime: labels.worktreeRuntime,
        conflictTitle: labels.worktreeConflictTitle,
        conflictHint: labels.worktreeConflictHint,
        handoffTitle: labels.handoffTitle,
        handoffTarget: labels.handoffTarget,
        handoffCommits: labels.handoffCommits,
        handoffReady: labels.handoffReady,
        handoffSourceDirty: labels.handoffSourceDirty,
        handoffTargetDirty: labels.handoffTargetDirty,
        handoffNoCommits: labels.handoffNoCommits,
        handoffOverlap: labels.handoffOverlap,
        handoffApply: labels.handoffApply,
        handoffRefresh: labels.handoffRefresh,
        handoffConfirmTitle: labels.handoffConfirmTitle,
        handoffConfirmBody: labels.handoffConfirmBody,
        handoffApplied: labels.handoffApplied,
      }}
    />
  );
}
