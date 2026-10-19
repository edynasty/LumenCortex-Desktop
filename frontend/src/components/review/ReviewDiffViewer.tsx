import { useEffect, useMemo, useState } from "react";
import { SyntaxLine } from "../code/SyntaxLine";
import { Button } from "../primitives/Button";
import { EmptyState } from "../primitives/EmptyState";
import { LoadingState } from "../primitives/LoadingState";
import type { DiffLine, SplitRow } from "./diff";

const DIFF_RENDER_CHUNK = 240;

type Props = {
  loading: boolean;
  binary: boolean;
  selectedPath: string;
  contentKey: string;
  mode: "unified" | "split";
  lines: DiffLine[];
  rows: SplitRow[];
  language: string;
  loadingLabel: string;
  binaryLabel: string;
  loadMoreLabel: string;
};

export function DiffCount({ added, removed }: { added: number; removed: number }) {
  return (
    <span className="diff-count">
      <span className="add">+{added}</span>
      <span className="del">−{removed}</span>
    </span>
  );
}

// Split diffs read only once the pane is wide enough; the choice follows the window.
export function useSplitDiffAvailable() {
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

export function ReviewDiffViewer({
  loading,
  binary,
  selectedPath,
  contentKey,
  mode,
  lines,
  rows,
  language,
  loadingLabel,
  binaryLabel,
  loadMoreLabel,
}: Props) {
  const totalItems = mode === "unified" ? lines.length : rows.length;
  const renderKey = `${contentKey}:${mode}:${totalItems}`;
  const [renderWindow, setRenderWindow] = useState({ key: renderKey, limit: DIFF_RENDER_CHUNK });
  const visibleLimit = renderWindow.key === renderKey ? renderWindow.limit : DIFF_RENDER_CHUNK;
  const visibleLines = useMemo(() => lines.slice(0, visibleLimit), [lines, visibleLimit]);
  const visibleRows = useMemo(() => rows.slice(0, visibleLimit), [rows, visibleLimit]);
  const visibleItems = Math.min(visibleLimit, totalItems);
  const hasMore = !loading && !binary && visibleItems < totalItems;

  return (
    <div className="review-diff">
      {loading ? (
        <LoadingState label={loadingLabel} />
      ) : binary ? (
        <EmptyState title={binaryLabel} body={selectedPath} />
      ) : mode === "unified" ? (
        <div className="diff-scroll review-unified">
          {visibleLines.map((line, index) => (
            <div className={`diff-line k-${line.kind}`} key={index}>
              <span className="diff-num">{line.kind !== "add" ? line.oldLine ?? "" : ""}</span>
              <span className="diff-num">{line.kind !== "delete" ? line.newLine ?? "" : ""}</span>
              <code>
                <span className="diff-prefix">
                  {line.kind === "add" ? "+" : line.kind === "delete" ? "-" : line.kind === "context" ? " " : ""}
                </span>
                {line.kind === "meta" ? line.text : <SyntaxLine text={line.text} language={language} />}
              </code>
            </div>
          ))}
        </div>
      ) : (
        <div className="diff-scroll review-split">
          {visibleRows.map((row, index) => (
            <div className="split-row" key={index}>
              <div className={`split-cell k-${row.left?.kind ?? "none"}`}>
                <span className="diff-num">{row.left?.oldLine ?? ""}</span>
                <code>
                  {row.left?.kind === "meta"
                    ? row.left?.text || ""
                    : <SyntaxLine text={row.left?.text || ""} language={language} />}
                </code>
              </div>
              <div className={`split-cell k-${row.right?.kind ?? "none"}`}>
                <span className="diff-num">{row.right?.newLine ?? ""}</span>
                <code>
                  {row.right?.kind === "meta"
                    ? row.right?.text || ""
                    : <SyntaxLine text={row.right?.text || ""} language={language} />}
                </code>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="review-diff-more">
          <span className="review-diff-progress">{visibleItems} / {totalItems}</span>
          <Button
            variant="ghost"
            onClick={() => setRenderWindow({
              key: renderKey,
              limit: Math.min(totalItems, visibleLimit + DIFF_RENDER_CHUNK),
            })}
          >
            {loadMoreLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
