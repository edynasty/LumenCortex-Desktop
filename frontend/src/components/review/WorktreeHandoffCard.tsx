import { ArrowRightLeft, CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { WorktreeHandoffPlan } from "../../types";
import { Button } from "../primitives/Button";
import { Dialog } from "../primitives/Dialog";

type Props = {
  plan: WorktreeHandoffPlan | null;
  loading: boolean;
  busy: boolean;
  notice: string;
  labels: {
    title: string;
    target: string;
    commits: string;
    ready: string;
    sourceDirty: string;
    targetDirty: string;
    noCommits: string;
    overlap: string;
    apply: string;
    refresh: string;
    confirmTitle: string;
    confirmBody: string;
    cancel: string;
    applied: string;
  };
  onRefresh: () => void;
  onApply: () => Promise<void> | void;
};

function blockedReason(plan: WorktreeHandoffPlan, labels: Props["labels"]) {
  if (plan.sourceDirty) return labels.sourceDirty;
  if (plan.targetDirty) return labels.targetDirty;
  if (!plan.commits.length) return labels.noCommits;
  if (plan.overlappingFiles.length) return labels.overlap;
  return plan.blockedReason || "";
}

export function WorktreeHandoffCard({ plan, loading, busy, notice, labels, onRefresh, onApply }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!plan && !loading) return null;

  return (
    <section className="worktree-handoff">
      <div className="worktree-handoff-head">
        <div>
          <ArrowRightLeft size={14} strokeWidth={1.7} aria-hidden />
          <strong>{labels.title}</strong>
        </div>
        <Button icon={<RefreshCw size={12} />} disabled={loading || busy} onClick={onRefresh}>
          {labels.refresh}
        </Button>
      </div>

      {plan && (
        <>
          <div className="worktree-handoff-meta">
            <span>{labels.target}</span>
            <code>{plan.targetBranch || plan.targetHead?.slice(0, 10) || "HEAD"}</code>
            <span>{labels.commits}</span>
            <code>{plan.commits.length}</code>
          </div>

          {plan.canApply ? (
            <div className="worktree-handoff-state ready">
              <CheckCircle2 size={14} strokeWidth={1.8} aria-hidden />
              <span>{labels.ready}</span>
            </div>
          ) : (
            <div className="worktree-handoff-state blocked">
              <TriangleAlert size={14} strokeWidth={1.8} aria-hidden />
              <span>{blockedReason(plan, labels)}</span>
            </div>
          )}

          {plan.overlappingFiles.length > 0 && (
            <div className="worktree-handoff-files">
              {plan.overlappingFiles.map((path) => <code key={path}>{path}</code>)}
            </div>
          )}

          {notice && <div className="worktree-handoff-notice">{labels.applied}: {notice}</div>}

          <div className="worktree-handoff-actions">
            <Button
              variant="primary"
              disabled={!plan.canApply || loading || busy}
              onClick={() => setConfirmOpen(true)}
            >
              {labels.apply}
            </Button>
          </div>
        </>
      )}

      <Dialog
        open={confirmOpen}
        title={labels.confirmTitle}
        description={labels.confirmBody}
        onOpenChange={setConfirmOpen}
        footer={
          <>
            <Button onClick={() => setConfirmOpen(false)}>{labels.cancel}</Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                await onApply();
                setConfirmOpen(false);
              }}
            >
              {labels.apply}
            </Button>
          </>
        }
      />
    </section>
  );
}
