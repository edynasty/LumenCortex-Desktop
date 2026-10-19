/*
 * Source Control sidebar (ADR-0005): the project checkout, then every worktree a thread owns
 * or borrows. Each row says where it forks from and what is pending there, so the list alone
 * answers "what still needs to reach main?". Counts come from Core's per-worktree inspection.
 */
import type { Session, SessionRuntime } from "../../types";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { Icon } from "../primitives/Icon";
import { statusGlyph } from "../sidebar/ThreadRow";

export type ScmWorktreeRow = {
  session: Session;
  runtime: SessionRuntime;
  title: string;
};

type Props = {
  workspace: string;
  checkout: "main" | string;
  worktrees: ScmWorktreeRow[];
  /** Pending counts per session id from Core's worktree inspections; absent while loading. */
  counts: Record<string, { ahead: number; dirty: number }> | undefined;
  /** Change count of the project checkout from Core's git status; undefined while loading. */
  mainCount: number | undefined;
  labels: AppCopy;
  onSelectCheckout: (checkout: "main" | string) => void;
};


export function ScmSidebar({ workspace, checkout, worktrees, counts, mainCount, labels, onSelectCheckout }: Props) {
  return (
    <nav className="sidebar-scroll scm-list" aria-label={labels.sourceControl}>
      <h3 className="section-label">{labels.scmCheckout}</h3>
      <button
        type="button"
        className={`scm-row ${checkout === "main" ? "is-selected" : ""}`}
        aria-current={checkout === "main" ? "page" : undefined}
        onClick={() => onSelectCheckout("main")}
        title={workspace}
      >
        <span className="scm-row-icon"><Icon name="local" size={15} /></span>
        <span className="scm-row-branch">{workspace.replace(/\\/g, "/").split("/").filter(Boolean).pop() || labels.scmCheckout}</span>
        {mainCount === undefined ? null : (
          <span className={`scm-row-state ${mainCount > 0 ? "is-dirty" : ""}`}>
            {mainCount > 0 ? labels.scmDirtyCount(mainCount) : labels.wtClean}
          </span>
        )}
        <span className="scm-row-sub mono">{workspace}</span>
      </button>

      <h3 className="section-label">{labels.scmWorktrees}<span className="section-count">{worktrees.length}</span></h3>
      {worktrees.length === 0 && <p className="sidebar-empty">{labels.scmNoWorktrees}</p>}
      {worktrees.map((worktree) => {
        const active = checkout === worktree.session.id;
        const pending = counts?.[worktree.session.id];
        const glyph = statusGlyph[worktree.session.status] ?? { icon: "idle" as const, tone: "is-idle" };
        return (
          <button
            key={worktree.session.id}
            type="button"
            className={`scm-row ${active ? "is-selected" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={() => onSelectCheckout(worktree.session.id)}
            title={`${worktree.runtime.branch || worktree.runtime.path}\n${worktree.title}`}
          >
            <span className="scm-row-icon"><Icon name="worktree" size={15} /></span>
            <span className="scm-row-branch mono">{worktree.runtime.branch || worktree.runtime.path}</span>
            {pending && (pending.ahead > 0 || pending.dirty > 0
              ? (
                <span className="scm-row-counts">
                  {pending.ahead > 0 && (
                    <span className="wt-ahead" title={labels.wtCommits}><Icon name="ahead" size={11} />{pending.ahead}</span>
                  )}
                  {pending.dirty > 0 && (
                    <span className="wt-dirty" title={labels.wtUncommitted}><Icon name="dirty" size={11} />{pending.dirty}</span>
                  )}
                </span>
              )
              : <span className="scm-row-clean">{labels.wtClean}</span>)}
            <span className="scm-row-sub">
              <Icon name={glyph.icon} size={11} className={`status-glyph ${glyph.tone}`} />
              <span>{worktree.title}</span>
            </span>
          </button>
        );
      })}
      <p className="scm-list-hint">{labels.scmWorktreesHint}</p>
    </nav>
  );
}
