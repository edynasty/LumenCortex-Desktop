/*
 * Changes of one checkout (the project's main or a session's worktree) in the Source Control
 * layout: file list + diff with stage / unstage / revert / commit / push. The same Demo
 * ChangesView language as the thread Changes tab, but driven by the GitEndpoint of whichever
 * checkout is selected. All state comes from Core via useReviewState; every action re-queries.
 */
import { useEffect, useMemo, useState } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { languageFromPath } from "../../lib/syntax";
import { Button } from "../primitives/Button";
import { Dialog } from "../primitives/Dialog";
import { Icon } from "../primitives/Icon";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { PathLabel } from "../primitives/PathLabel";
import { diffStats, parseUnifiedDiff, splitDiffRows } from "../review/diff";
import { ReviewDiffViewer, DiffCount, useSplitDiffAvailable } from "../review/ReviewDiffViewer";
import { statusLabel, useReviewState, type DiffScope, type GitEndpoint } from "../review/useReviewState";
import "../review/review.css";

type Props = {
  /** The Git surface to read and act on: Core's answers for one checkout. */
  endpoint: GitEndpoint;
  /** Present while mounted; a change re-queries Core (e.g. after an apply). */
  revision?: number;
  /** The session id for conflict relevance; absent for the project checkout. */
  sessionId?: string;
  labels: AppCopy;
};

export function ScmChangesView({ endpoint, revision, sessionId, labels }: Props) {
  const review = useReviewState(endpoint);
  const [mode, setMode] = useState<"unified" | "split">("unified");
  const splitDiffAvailable = useSplitDiffAvailable();
  const [revertTarget, setRevertTarget] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const lines = useMemo(() => parseUnifiedDiff(review.diff.content), [review.diff.content]);
  const rows = useMemo(() => splitDiffRows(lines), [lines]);
  const stats = useMemo(() => diffStats(lines), [lines]);
  const language = useMemo(() => languageFromPath(review.selectedPath), [review.selectedPath]);
  const binaryDiff = /(^|\n)(Binary files .* differ|GIT binary patch)(\n|$)/.test(review.diff.content);
  const selectedStatus = review.selectedFile
    ? statusLabel(review.selectedFile.index, review.selectedFile.worktree)
    : "";
  const canStage = Boolean(review.selectedFile && (review.selectedFile.worktree !== " " || review.selectedFile.index === "?"));

  const canUnstage = Boolean(review.selectedFile && review.selectedFile.index !== " " && review.selectedFile.index !== "?");
  // Core is re-queried whenever the parent's revision moves (e.g. an apply changed the tree).
  useEffect(() => {
    if (revision) void review.refresh();
  }, [revision, review.refresh]);

  useEffect(() => {
    if (!splitDiffAvailable && mode === "split") setMode("unified");
  }, [mode, splitDiffAvailable]);

  // Core's conflicts on the files of this checkout: the worktree's own for a session, the
  // project's local side for the main checkout.
  const relevantConflicts = useMemo(
    () => review.conflicts.filter((conflict) =>
      sessionId
        ? conflict.owners.some((owner) => owner.sessionId === sessionId)
        : conflict.owners.some((owner) => owner.kind === "local"),
    ),
    [review.conflicts, sessionId],
  );

  if (review.status.files.length === 0 && !review.loading) {
    return (
      <div className="changes-view">
        <div className="changes-empty">
          <Icon name="changes" size={22} />
          <p>{labels.noChanges}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="changes-view">
      <div className="changes-toolbar">
        <span className="changes-summary">
          <span className="changes-summary-text">{labels.scmFilesChanged(review.status.files.length)}</span>
          <DiffCount added={stats.additions} removed={stats.deletions} />
        </span>
        <span className="toolbar-spacer" />
        <SegmentedControl<DiffScope>
          size="sm"
          value={review.scope}
          ariaLabel={labels.worktree}
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
            ariaLabel={labels.unified}
            options={[
              { value: "unified", label: labels.unified },
              { value: "split", label: labels.split },
            ]}
            onChange={setMode}
          />
        )}
        {canStage && <Button size="sm" variant="ghost" disabled={review.actionBusy} onClick={() => void review.stage()}>{labels.stage}</Button>}
        {canUnstage && <Button size="sm" variant="ghost" disabled={review.actionBusy} onClick={() => void review.unstage()}>{labels.unstage}</Button>}
      </div>

      {review.diff.truncated && <div className="review-warning">{labels.diffTruncated}</div>}
      {review.error && <div className="review-error">{review.error}</div>}
      {review.notice && <div className="review-notice">{review.notice}</div>}
      {relevantConflicts.length > 0 && (
        <div className="review-conflicts">
          <strong>{labels.worktreeConflictTitle}</strong>
          <span>{labels.worktreeConflictHint}</span>
          <div>
            {relevantConflicts.map((conflict) => (
              <code key={conflict.path}>{conflict.path}</code>
            ))}
          </div>
        </div>
      )}

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
              <button
                type="button"
                className="icon-btn is-sm file-row-revert"
                aria-label={labels.revert}
                title={labels.revert}
                onClick={(event) => {
                  event.stopPropagation();
                  review.setSelectedPath(file.path);
                  setRevertTarget(file.path);
                }}
              >
                <Icon name="revert" size={13} />
              </button>
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
        <Button disabled={review.actionBusy} onClick={() => void review.push()}>{labels.push}</Button>
      </footer>

      <Dialog
        open={revertTarget !== null}
        title={labels.revertTitle}
        description={labels.revertBody}
        closeLabel={labels.cancel}
        onOpenChange={(open) => { if (!open) setRevertTarget(null); }}
        footer={
          <>
            <Button onClick={() => setRevertTarget(null)}>{labels.cancel}</Button>
            <Button
              variant="danger"
              onClick={() => {
                setRevertTarget(null);
                void review.revert();
              }}
            >
              {labels.revert}
            </Button>
          </>
        }
      />
    </div>
  );
}
