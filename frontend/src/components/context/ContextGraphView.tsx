/*
 * Context graph lens: threads on the left, the files they reference on the right. Edges are
 * SVG; nodes are real buttons so text stays crisp, focus is visible and the graph is
 * keyboard-navigable (arrows move along columns and across edges, Escape clears). Hover or
 * selection dims everything not directly connected. Ported from the Demo's ContextGraph.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { Icon } from "../primitives/Icon";
import { PathLabel } from "../primitives/PathLabel";
import { edgePath, layoutGraph, neighborhood, type ContextGraph, type Placed } from "./context-page-types";

export function ContextGraphView({ graph, labels, selected, onSelect }: {
  graph: ContextGraph;
  labels: AppCopy;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { placed, height } = useMemo(() => layoutGraph(graph, width), [graph, width]);
  const focusId = hover ?? selected;
  const near = useMemo(() => neighborhood(graph, focusId && placed.has(focusId) ? focusId : null), [graph, focusId, placed]);

  const byCol = useMemo(() => {
    const cols: Placed[][] = [[], []];
    for (const p of placed.values()) cols[p.node.col].push(p);
    cols.forEach((col) => col.sort((a, b) => a.y - b.y));
    return cols;
  }, [placed]);

  const focusNode = (id: string) => box.current?.querySelector<HTMLButtonElement>(`[data-node="${CSS.escape(id)}"]`)?.focus();
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, p: Placed) => {
    const col = byCol[p.node.col];
    const i = col.indexOf(p);
    let next: Placed | undefined;
    if (event.key === "ArrowDown") next = col[i + 1];
    else if (event.key === "ArrowUp") next = col[i - 1];
    else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const target = p.node.col + (event.key === "ArrowRight" ? 1 : -1);
      if (target < 0 || target > 1) return;
      const linked = graph.edges
        .filter((edge) => edge.from === p.node.id || edge.to === p.node.id)
        .map((edge) => placed.get(edge.from === p.node.id ? edge.to : edge.from))
        .filter((q): q is Placed => Boolean(q) && q!.node.col === target);
      const pool = linked.length ? linked : byCol[target] ?? [];
      next = pool.slice().sort((a, b) => Math.abs(a.y - p.y) - Math.abs(b.y - p.y))[0];
    } else if (event.key === "Escape") {
      onSelect(null);
      return;
    }
    if (next) {
      event.preventDefault();
      focusNode(next.node.id);
    }
  };

  if (graph.nodes.length === 0) return <p className="cg-empty">{labels.contextGraphEmpty}</p>;

  return (
    <div className="cg" ref={box}>
      <div className="cg-cols">
        <span style={{ left: 16 }}>{labels.contextColThreads}</span>
        <span style={{ right: 16 }}>{labels.contextColFiles}</span>
      </div>
      <div className="cg-canvas" style={{ height }}>
        <svg className="cg-edges" width={width} height={height} aria-hidden>
          {graph.edges.map((edge) => {
            const a = placed.get(edge.from);
            const b = placed.get(edge.to);
            if (!a || !b) return null;
            const on = !near || (near.has(edge.from) && near.has(edge.to));
            return (
              <path
                key={edge.id}
                className={`cg-edge k-${edge.kind} ${on ? "is-on" : "is-dim"}`}
                d={edgePath(a, b)}
              />
            );
          })}
        </svg>
        {[...placed.values()].map((p) => {
          const dim = near ? !near.has(p.node.id) : false;
          const hot = near && focusId === p.node.id;
          const selectedHere = selected === p.node.id;
          return (
            <button
              key={p.node.id}
              type="button"
              data-node={p.node.id}
              className={`cg-node k-${p.node.kind} ${p.node.kind === "file" && p.node.suggestedOnly ? "is-suggested" : ""} ${dim ? "is-dim" : ""} ${hot ? "is-hot" : ""} ${selectedHere ? "is-selected" : ""}`}
              style={{ left: p.x, top: p.y - p.h / 2, width: p.w, height: p.h }}
              onClick={() => onSelect(p.node.id)}
              onFocus={() => setHover(p.node.id)}
              onBlur={() => setHover(null)}
              onMouseEnter={() => setHover(p.node.id)}
              onMouseLeave={() => setHover(null)}
              onKeyDown={(event) => onKey(event, p)}
              aria-current={selectedHere ? "true" : undefined}
            >
              {p.node.kind === "thread" ? (
                <>
                  <Icon name={p.node.finished ? "done" : "discussion"} size={13} />
                  <span className="cg-label">{p.node.title}</span>
                </>
              ) : (
                <>
                  <Icon name={p.node.suggestedOnly ? "stale" : "file"} size={13} />
                  <PathLabel path={p.node.path} />
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="cg-legend">
        <span><i className="cg-swatch k-includes" />{labels.contextLegendIncludes}</span>
        <span><i className="cg-swatch k-suggests" />{labels.contextLegendSuggests}</span>
        <span><i className="cg-swatch k-links" />{labels.contextLegendLinks}</span>
        <span><i className="cg-swatch k-child" />{labels.contextLegendChild}</span>
      </div>
      {graph.truncatedFiles > 0 && <p className="cg-truncated">{labels.contextTruncatedFiles(graph.truncatedFiles)}</p>}
    </div>
  );
}
