/*
 * One worktree in Source Control (Demo ScmView's WorktreeView): ownership and lifecycle from
 * Core's inspection, its changes (stage/commit/revert) and its commits, with the only actions
 * the runtime allows — apply to base, open the thread, clean up. Borrowed and running
 * worktrees are read-only. The handoff strip keeps the review's confirmation semantics.
 */
import { useMemo, useState } from "react";
import type { Session, SessionRuntime, WorktreeInspection } from "../../types";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { sessionUI } from "../../lib/session-ui";
import { AnchoredPopover } from "../primitives/AnchoredPopover";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { IconButton } from "../primitives/IconButton";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { statusGlyph } from "../sidebar/ThreadRow";
import { sessionGitEndpoint } from "../review/useReviewState";
import { useWorktreeHandoff } from "../review/useWorktreeHandoff";
import { WorktreeHandoffCard } from "../review/WorktreeHandoffCard";
import { ScmChangesView } from "./ScmChangesView";
import type { WorktreeCleanupTarget } from "../worktree/WorktreeCleanupDialog";
import "./scm.css";

type Props = {
  session: Session;
  runtime: SessionRuntime;
  inspection: WorktreeInspection | null;
  labels: AppCopy;
  onOpenThread: (sessionId: string) => void;
  onCleanupWorktree: (target: WorktreeCleanupTarget) => void;
  /** Called after an apply reached the base, so the page re-queries Core. */
  onApplied: () => void;
};

const roleLabel: Record<string, keyof AppCopy> = {
  owner: "wtOwner",
  borrower: "wtBorrower",
  uncertain: "wtUncertain",
};

function CommitList({ commits, labels }: { commits: string[]; labels: AppCopy }) {
  if (commits.length === 0) return <p className="scm-empty">{labels.scmNoCommits}</p>;
  return (
    <ol className="scm-commits">
      {commits.map((commit) => {
        const sha = commit.slice(0, commit.indexOf(" ")) || commit;
        const message = commit.slice(sha.length).trim();
        return (
          <li key={commit}>
            <Icon name="commit" size={14} />
            <span className="scm-commit-msg">{message || sha}</span>
            <span className="scm-tag is-pending">{labels.scmPendingTag}</span>
            <span className="mono scm-commit-sha">{sha}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ScmWorktreeView({ session, runtime, inspection, labels, onOpenThread, onCleanupWorktree, onApplied }: Props) {
  const [tab, setTab] = useState<"changes" | "commits">("changes");
  const [menuOpen, setMenuOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const running = session.status === "running";
  const role = inspection?.role || "";
  const commits = inspection?.unappliedCommits ?? [];
  const ignored = inspection?.ignoredFiles ?? [];
  const title = sessionUI(session).title;
  const glyph = statusGlyph[session.status] ?? { icon: "idle" as const, tone: "is-idle" };

  const handoff = useWorktreeHandoff({
    sessionId: session.id,
    runtimeKind: "worktree",
    revision,
    agentRunning: running,
    appliedLabel: labels.handoffApplied,
    onAfterApply: async () => {
      setRevision((value) => value + 1);
      onApplied();
    },
  });

  const endpoint = useMemo(() => sessionGitEndpoint(session.id), [session.id]);

  return (
    <div className="scm-worktree">
      <header className="scm-head is-bar">
        <span className="scm-head-icon"><Icon name="worktree" size={18} /></span>
        <div className="scm-head-text">
          <h2 className="mono" title={runtime.branch}>{runtime.branch || runtime.path}</h2>
          <span className="scm-head-sub">
            <Icon name={glyph.icon} size={11} className={`status-glyph ${glyph.tone}`} />
            <span className="scm-head-thread">{title}</span>
          </span>
        </div>
        <div className="scm-head-actions">
          <Button size="sm" variant="ghost" icon={<Icon name="discussion" size={13} />} onClick={() => onOpenThread(session.id)}>
            {labels.scmOpenThread}
          </Button>
          <div className="popover-anchor">
            <IconButton
              icon={<Icon name="more" size={14} />}
              label={labels.scmMore}
              disabled={running}
              active={menuOpen}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              title={running ? labels.worktreeBusyHint : undefined}
              onClick={() => setMenuOpen(!menuOpen)}
            />
            <AnchoredPopover open={menuOpen} onClose={() => setMenuOpen(false)} placement="below-end" label={labels.scmMore} className="menu">
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  onCleanupWorktree({ mode: "remove", sessionId: session.id });
                }}
              >
                <Icon name="worktree" size={15} />
                <span className="menu-item-body"><span>{labels.scmRemoveWorktree}</span></span>
              </button>
            </AnchoredPopover>
          </div>
        </div>
      </header>

      <dl className="scm-facts is-inline">
        <div><dt>{labels.scmBase}</dt><dd className="mono">{runtime.base || labels.scmHead}</dd></div>
        <div><dt>{labels.scmOwner}</dt><dd>{role ? labels[roleLabel[role]] as string : ""}</dd></div>
        <div className="is-wide"><dt>{labels.scmPath}</dt><dd className="mono" title={runtime.path}>{runtime.path}</dd></div>
      </dl>

      {running && <p className="scm-note"><Icon name="idle" size={14} />{labels.scmRunningNote}</p>}
      {!running && role === "borrower" && <p className="scm-note"><Icon name="readOnly" size={14} />{labels.scmBorrowerNote}</p>}

      <WorktreeHandoffCard
        plan={handoff.plan}
        loading={handoff.loading}
        busy={handoff.busy || running}
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

      <div className="scm-tabs">
        <SegmentedControl<"changes" | "commits">
          size="sm"
          ariaLabel={runtime.branch || runtime.path}
          value={tab}
          onChange={setTab}
          options={[
            { value: "changes", label: labels.scmTabChanges },
            { value: "commits", label: <>{labels.scmTabCommits}{commits.length > 0 && <span className="seg-count">{commits.length}</span>}</> },
          ]}
        />
        {ignored.length > 0 && (
          <span className="scm-ignored" title={ignored.join("\n")}>
            {labels.wtIgnored} · <span className="mono">{ignored.slice(0, 3).join(" · ")}{ignored.length > 3 ? " ·…" : ""}</span>
          </span>
        )}
      </div>

      <div className="scm-tab-body">
        {tab === "changes"
          ? <ScmChangesView endpoint={endpoint} revision={revision} sessionId={session.id} labels={labels} />
          : <div className="scm-scroll"><CommitList commits={commits} labels={labels} /></div>}
      </div>
    </div>
  );
}
