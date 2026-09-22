import { EmptyState } from "../primitives/EmptyState";
import { SyntaxLine } from "../code/SyntaxLine";
import type { DiffLine, SplitRow } from "./diff";

type Props = {
  loading: boolean;
  binary: boolean;
  selectedPath: string;
  mode: "unified" | "split";
  lines: DiffLine[];
  rows: SplitRow[];
  language: string;
  loadingLabel: string;
  binaryLabel: string;
};

export function ReviewDiffViewer({
  loading,
  binary,
  selectedPath,
  mode,
  lines,
  rows,
  language,
  loadingLabel,
  binaryLabel,
}: Props) {
  return (
    <div className="review-diff">
      {loading ? (
        <div className="review-loading">{loadingLabel}</div>
      ) : binary ? (
        <EmptyState title={binaryLabel} body={selectedPath} />
      ) : mode === "unified" ? (
        <div className="review-unified">
          {lines.map((line, index) => (
            <div className={`diff-line ${line.kind}`} key={index}>
              <span>{line.oldLine ?? ""}</span>
              <span>{line.newLine ?? ""}</span>
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
        <div className="review-split">
          {rows.map((row, index) => (
            <div className="split-row" key={index}>
              <div className={`split-cell ${row.left?.kind || ""}`}>
                <span>{row.left?.oldLine ?? ""}</span>
                <code>
                  {row.left?.kind === "meta"
                    ? row.left?.text || ""
                    : <SyntaxLine text={row.left?.text || ""} language={language} />}
                </code>
              </div>
              <div className={`split-cell ${row.right?.kind || ""}`}>
                <span>{row.right?.newLine ?? ""}</span>
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
    </div>
  );
}
