import { useMemo, useState } from "react";
import { GitBranch, RotateCcw, Upload } from "lucide-react";
import { Button } from "../primitives/Button";
import { Dialog } from "../primitives/Dialog";
import { EmptyState } from "../primitives/EmptyState";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { diffStats, parseUnifiedDiff, splitDiffRows } from "./diff";
import { useReviewState, type DiffScope } from "./useReviewState";
import "./review.css";

type Props = {
  workspace: string;
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
    loading: string;
  };
};

function statusLabel(index: string, worktree: string) {
  if (index === "?" && worktree === "?") return "U";
  if (index !== " " && index !== "?") return index;
  return worktree === " " ? "M" : worktree;
}

export function ReviewWorkspace({ workspace, labels }: Props) {
  const review = useReviewState(workspace);
  const [mode, setMode] = useState<"unified" | "split">("unified");
  const [revertOpen, setRevertOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const lines = useMemo(() => parseUnifiedDiff(review.diff.content), [review.diff.content]);
  const rows = useMemo(() => splitDiffRows(lines), [lines]);
  const stats = useMemo(() => diffStats(lines), [lines]);
  const canStage = Boolean(review.selectedFile && (review.selectedFile.worktree !== " " || review.selectedFile.index === "?"));
  const canUnstage = Boolean(review.selectedFile && review.selectedFile.index !== " " && review.selectedFile.index !== "?");

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
        {!review.status.files.length && !review.loading ? (
          <EmptyState icon={<GitBranch size={22} />} title={labels.noChanges} />
        ) : (
          <>
            <header className="review-toolbar">
              <div className="review-file-title">
                <strong>{review.selectedPath || labels.title}</strong>
                <span>+{stats.additions} −{stats.deletions}</span>
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
                <SegmentedControl
                  value={mode}
                  ariaLabel="Diff layout"
                  options={[
                    { value: "unified", label: labels.unified },
                    { value: "split", label: labels.split },
                  ]}
                  onChange={setMode}
                />
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

            <div className="review-diff">
              {review.loading ? (
                <div className="review-loading">{labels.loading}</div>
              ) : mode === "unified" ? (
                <div className="review-unified">
                  {lines.map((line, index) => (
                    <div className={`diff-line ${line.kind}`} key={index}>
                      <span>{line.oldLine ?? ""}</span>
                      <span>{line.newLine ?? ""}</span>
                      <code>{line.kind === "add" ? "+" : line.kind === "delete" ? "-" : line.kind === "context" ? " " : ""}{line.text}</code>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="review-split">
                  {rows.map((row, index) => (
                    <div className="split-row" key={index}>
                      <div className={`split-cell ${row.left?.kind || ""}`}>
                        <span>{row.left?.oldLine ?? ""}</span>
                        <code>{row.left?.text || ""}</code>
                      </div>
                      <div className={`split-cell ${row.right?.kind || ""}`}>
                        <span>{row.right?.newLine ?? ""}</span>
                        <code>{row.right?.text || ""}</code>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
