/*
 * The project checkout in Source Control (Demo ScmView's CheckoutView): its own changes
 * (stage/commit/revert/push via Core's project Git answers) and the branch graph of every
 * worktree forked from the base with the commits still waiting to be applied.
 */
import { useMemo, useState } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { Icon } from "../primitives/Icon";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { checkoutGitEndpoint } from "../review/useReviewState";
import { ScmChangesView } from "./ScmChangesView";
import { ScmBranchGraph, type ScmGraphWorktree } from "./ScmBranchGraph";
import "./scm.css";

type Props = {
  workspace: string;
  worktrees: ScmGraphWorktree[];
  baseBranch: string;
  baseHead?: string;
  /** Change count of the project checkout from Core's git status; undefined while loading. */
  changeCount: number | undefined;
  /** The page's revision counter; a change re-queries Core. */
  revision: number;
  labels: AppCopy;
  onSelectCheckout: (sessionId: string) => void;
};

export function ScmCheckoutView({ workspace, worktrees, baseBranch, baseHead, changeCount, revision, labels, onSelectCheckout }: Props) {
  const [tab, setTab] = useState<"changes" | "graph">("changes");
  const endpoint = useMemo(() => checkoutGitEndpoint(), []);

  return (
    <div className="scm-view">
      <header className="scm-head is-bar">
        <span className="scm-head-icon"><Icon name="local" size={18} /></span>
        <div className="scm-head-text">
          <h2 className="mono">{baseBranch || workspace.replace(/\\/g, "/").split("/").filter(Boolean).pop()}</h2>
          <span className="scm-head-sub">{labels.scmCheckout} · <span className="mono">{workspace}</span></span>
        </div>
      </header>

      <dl className="scm-facts">
        {baseHead && <div><dt>{labels.scmHead}</dt><dd className="mono">{baseHead}</dd></div>}
        <div><dt>{labels.scmWorktrees}</dt><dd>{worktrees.length}</dd></div>
        <div className="is-wide">
          <dt>{labels.scmState}</dt>
          <dd className={changeCount === undefined ? "is-pending" : changeCount > 0 ? "is-warn" : "is-ok"}>
            {changeCount === undefined ? (
              // The count is still being read: a blank cell would read as "no state".
              <span role="status">{labels.loading}</span>
            ) : (
              <>
                <Icon name={changeCount > 0 ? "stale" : "done"} size={13} />
                {changeCount > 0 ? labels.scmTargetDirty : labels.scmTargetClean}
              </>
            )}
          </dd>
        </div>
      </dl>

      <div className="scm-tabs">
        <SegmentedControl<"changes" | "graph">
          size="sm"
          ariaLabel={labels.scmCheckout}
          value={tab}
          onChange={setTab}
          options={[
            { value: "changes", label: labels.scmTabChanges },
            { value: "graph", label: labels.scmGraph },
          ]}
        />
      </div>

      <div className="scm-tab-body">
        {tab === "changes" ? (
          <ScmChangesView endpoint={endpoint} revision={revision} labels={labels} />
        ) : (
          <div className="scm-scroll">
            <section className="scm-section">
              <h3 className="section-label">{labels.scmGraph}</h3>
              <p className="scm-section-hint">{labels.scmGraphHint}</p>
              {worktrees.length === 0
                ? <p className="scm-empty">{labels.scmNoWorktrees}</p>
                : <ScmBranchGraph baseBranch={baseBranch} baseHead={baseHead} worktrees={worktrees} selected="main" labels={labels} onSelectCheckout={onSelectCheckout} />}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
