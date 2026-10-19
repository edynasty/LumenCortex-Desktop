/*
 * Project Context graph, adapted from the Lumen Glass Demo's ADR-0007 graph. Grounded only
 * in Core data the Desktop already holds: sessions and each thread's Task State references.
 * Threads are the entries; files and other threads become graph nodes only when a reference
 * names them. Nothing is inferred from content: Core has no notes yet, so the Demo's note
 * column, citations and typed note links are not drawn (documented in useContextPage).
 *
 * Supported relations:
 *   thread→file   Task State references with kind "path" and state included (solid) or
 *                 suggested (dashed). Excluded references are never edges.
 *   thread→thread references with kind "thread" (both ends inside the loaded bound), plus
 *                 the subagent parent/child relation Core records in session metadata.
 */
import type { Session, TaskStateInfo } from "../../types";
import { sessionUI } from "../../lib/session-ui";

/** Loading bound: Task State is fetched for at most this many recent non-archived threads. */
export const CONTEXT_THREAD_BOUND = 30;
/** Drawing bound: files beyond this are counted, not drawn. */
export const GRAPH_MAX_FILES = 60;

export type ContextNode =
  | {
      id: string; col: 0; kind: "thread";
      sessionId: string; title: string; status: string;
      /** True once the thread's Task State reports resolution "done". */
      finished: boolean; pinned: boolean;
    }
  | {
      id: string; col: 1; kind: "file";
      path: string;
      /** Every edge to this file is a suggestion; nothing includes it yet. */
      suggestedOnly: boolean;
    };

export type ContextEdgeKind = "includes" | "suggests" | "links" | "child";
export type ContextEdge = {
  id: string; from: string; to: string; kind: ContextEdgeKind;
  /** Who recorded the reference ("user", "agent", or the Core actor string). */
  by?: string; note?: string;
};

export type ContextGraph = {
  nodes: ContextNode[];
  edges: ContextEdge[];
  /** Files beyond GRAPH_MAX_FILES that references name but the graph does not draw. */
  truncatedFiles: number;
};

export type ContextFilter = "all" | "threads" | "files";
export type ContextLens = "list" | "graph";

/** Route item for a file: files are graph nodes, not stored items. */
export const fileItem = (path: string) => `file:${path}`;
export const fileOf = (item: string | null) => (item?.startsWith("file:") ? item.slice(5) : null);

/** The N most recent non-archived threads, newest first. The page's only loading bound. */
export function boundThreads(sessions: Session[], bound = CONTEXT_THREAD_BOUND): Session[] {
  return sessions
    .filter((session) => !sessionUI(session).archived)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id.localeCompare(b.id)))
    .slice(0, bound);
}

/**
 * Threads + loaded Task States → nodes and edges. Archived threads never appear: they are
 * filtered by boundThreads and an edge to a target outside the bound is skipped, exactly
 * like the Demo only links drawn items.
 */
export function contextGraph(threads: Session[], states: Map<string, TaskStateInfo>): ContextGraph {
  const nodes = new Map<string, ContextNode>();
  const edges: ContextEdge[] = [];
  const seen = new Set<string>();
  let truncatedFiles = 0;
  let fileCount = 0;

  const push = (edge: ContextEdge) => {
    if (seen.has(edge.id)) return;
    seen.add(edge.id);
    edges.push(edge);
  };

  for (const session of threads) {
    const ui = sessionUI(session);
    nodes.set(session.id, {
      id: session.id,
      col: 0,
      kind: "thread",
      sessionId: session.id,
      title: ui.title,
      status: session.status,
      finished: states.get(session.id)?.state.resolution.state === "done",
      pinned: ui.pinned,
    });
  }

  // Parent/child first: Core records the subagent link in the child's session metadata.
  for (const session of threads) {
    const parent = sessionUI(session).parentSessionId;
    if (parent && parent !== session.id && nodes.has(parent)) {
      push({ id: `child:${parent}>${session.id}`, from: parent, to: session.id, kind: "child" });
    }
  }

  for (const session of threads) {
    const info = states.get(session.id);
    for (const ref of info?.state.references ?? []) {
      // Excluded (and unknown) reference states are never edges.
      if (ref.state !== "included" && ref.state !== "suggested") continue;
      if (ref.kind === "path") {
        const id = fileItem(ref.target);
        let node = nodes.get(id);
        if (!node) {
          if (fileCount >= GRAPH_MAX_FILES) {
            truncatedFiles += 1;
            continue;
          }
          node = { id, col: 1, kind: "file", path: ref.target, suggestedOnly: true };
          nodes.set(id, node);
          fileCount += 1;
        }
        const kind: ContextEdgeKind = ref.state === "suggested" ? "suggests" : "includes";
        if (kind === "includes" && node.kind === "file") node.suggestedOnly = false;
        push({ id: `ref:${session.id}>${id}:${kind}`, from: session.id, to: id, kind, by: ref.by, note: ref.note });
      } else if (ref.kind === "thread") {
        if (ref.target === session.id || !nodes.has(ref.target)) continue;
        push({ id: `ref:${session.id}>${ref.target}:thread`, from: session.id, to: ref.target, kind: "links", by: ref.by, note: ref.note });
      }
    }
  }

  return { nodes: [...nodes.values()], edges, truncatedFiles };
}

/** Threads that hold a reference (any state) to `id`; the file detail's "cited by" list. */
export function citingThreads(graph: ContextGraph, fileId: string): ContextEdge[] {
  return graph.edges.filter((edge) => edge.to === fileId && (edge.kind === "includes" || edge.kind === "suggests"));
}

/** Ids directly connected to `id` (plus itself). */
export function neighborhood(graph: ContextGraph, id: string | null): Set<string> | null {
  if (!id) return null;
  const set = new Set([id]);
  for (const edge of graph.edges) {
    if (edge.from === id) set.add(edge.to);
    if (edge.to === id) set.add(edge.from);
  }
  return set;
}

/* —— Deterministic layered layout (ported from the Demo's graph.ts) —— */

export type Placed = { node: ContextNode; x: number; y: number; w: number; h: number };
export const NODE_H: Record<ContextNode["kind"], number> = { thread: 44, file: 32 };
const ROW = 56;
const PAD_Y = 14;

/**
 * Threads keep recency order in the left column; files sit at the mean height of their
 * neighbour threads (barycentre), then are pushed apart to a minimum gap. Same input →
 * same picture; no simulation, no randomness.
 */
export function layoutGraph(graph: ContextGraph, width: number): { placed: Map<string, Placed>; height: number } {
  const cols: ContextNode[][] = [[], []];
  for (const node of graph.nodes) cols[node.col].push(node);
  const gutter = width < 640 ? 28 : 56;
  const inner = Math.max(420, width - gutter - 32);
  const ws = [Math.round(inner * 0.55), Math.round(inner * 0.45)];
  const xs = [16, 16 + ws[0] + gutter];
  const rows = Math.max(cols[0].length, cols[1].length, 1);
  const height = PAD_Y * 2 + rows * ROW;
  const placed = new Map<string, Placed>();
  const put = (node: ContextNode, y: number) => placed.set(node.id, { node, x: xs[node.col], y, w: ws[node.col], h: NODE_H[node.kind] });

  const threads = cols[0];
  const span = (count: number) => ((rows - count) * ROW) / 2;
  threads.forEach((node, i) => put(node, PAD_Y + span(threads.length) + i * ROW + ROW / 2));

  const neighbors = (id: string) =>
    graph.edges.filter((edge) => edge.from === id || edge.to === id).map((edge) => (edge.from === id ? edge.to : edge.from));
  const files = cols[1]
    .map((node, i) => {
      const ys = neighbors(node.id).map((id) => placed.get(id)?.y).filter((y): y is number => y !== undefined);
      return { node, want: ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : PAD_Y + span(cols[1].length) + i * ROW + ROW / 2, i };
    })
    .sort((a, b) => a.want - b.want || a.i - b.i);
  const ys = files.map((f) => f.want);
  const top = PAD_Y + ROW / 2;
  const bottom = height - PAD_Y - ROW / 2;
  for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], i ? ys[i - 1] + ROW : top);
  for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i], i < ys.length - 1 ? ys[i + 1] - ROW : bottom);
  for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], i ? ys[i - 1] + ROW : top);
  files.forEach((f, i) => put(f.node, ys[i]));

  return { placed, height };
}

/** Edge path: cross-column links get a horizontal S-curve; thread→thread links bow out left. */
export function edgePath(a: Placed, b: Placed): string {
  if (a.node.col === b.node.col) {
    const x = a.x;
    const bow = 18 + Math.abs(b.y - a.y) * 0.22;
    return `M${x} ${a.y} C${x - bow} ${a.y} ${x - bow} ${b.y} ${x} ${b.y}`;
  }
  const [l, r] = a.node.col < b.node.col ? [a, b] : [b, a];
  const x1 = l.x + l.w;
  const x2 = r.x;
  const mid = (x1 + x2) / 2;
  return `M${x1} ${l.y} C${mid} ${l.y} ${mid} ${r.y} ${x2} ${r.y}`;
}
