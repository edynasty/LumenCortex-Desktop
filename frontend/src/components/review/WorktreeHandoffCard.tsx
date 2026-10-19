import { useState } from "react";
import type { WorktreeHandoffPlan } from "../../types";
import { Button } from "../primitives/Button";
import { Dialog } from "../primitives/Dialog";
import { Icon } from "../primitives/Icon";

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

// The Demo's handoff strip: one quiet accent band that says where the commits go and whether
// they can go there; Apply keeps the review's confirm-then-act semantics.
export function WorktreeHandoffCard({ plan, loading, busy, notice, labels, onRefresh, onApply }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!plan && !loading) return null;

  return (
    <section className="handoff" aria-label={labels.title}>
      <Icon name="apply" size={15} />
      <div className="handoff-text">
        {plan ? (
          <>
            <span>
              <strong>{labels.title}</strong>
              {" · "}{labels.target} <code>{plan.targetBranch || plan.targetHead?.slice(0, 10) || "HEAD"}</code>
              {" · "}{labels.commits} {plan.commits.length}
            </span>
            {plan.canApply ? (
              <span className="is-ready">
                <Icon name="done" size={12} />{labels.ready}
              </span>
            ) : (
              <span className="is-blocked">
                <Icon name="stale" size={12} />{blockedReason(plan, labels)}
              </span>
            )}
          </>
        ) : (
          <span>{labels.title}</span>
        )}
        {plan && plan.overlappingFiles.length > 0 && (
          <span className="handoff-files">
            {plan.overlappingFiles.map((path) => <code key={path}>{path}</code>)}
          </span>
        )}
        {notice && <span className="handoff-notice">{labels.applied}: {notice}</span>}
      </div>
      <Button size="sm" variant="ghost" icon={<Icon name="refresh" size={12} />} disabled={loading || busy} onClick={onRefresh}>
        {labels.refresh}
      </Button>
      {plan && (
        <Button size="sm" variant="primary" disabled={!plan.canApply || loading || busy} onClick={() => setConfirmOpen(true)}>
          {labels.apply}
        </Button>
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
