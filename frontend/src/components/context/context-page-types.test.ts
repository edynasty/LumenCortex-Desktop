/*
 * The Context page's pure adapter: sessions + task states → graph. Ports the Demo's
 * graph.test.ts to the Core-data shapes: excluded references are never edges, archived
 * threads are omitted, the loading bound is respected, layout is deterministic.
 */
import { describe, expect, it } from "vitest";
import type { Session, TaskStateInfo } from "../../types";
import {
  CONTEXT_THREAD_BOUND,
  GRAPH_MAX_FILES,
  boundThreads,
  contextGraph,
  fileItem,
  layoutGraph,
  neighborhood,
} from "./context-page-types";

const at = (minutes: number) => new Date(Date.UTC(2026, 9, 17, 1, minutes)).toISOString();

function session(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id,
    createdAt: at(0),
    updatedAt: at(10),
    status: "created",
    goal: `goal of ${id}`,
    metadata: {},
    ...overrides,
  };
}

function state(sessionId: string, references: TaskStateInfo["state"]["references"], resolution = "open"): TaskStateInfo {
  return {
    sessionId,
    version: 1,
    pendingEdits: 0,
    state: { references, resolution: { state: resolution }, windowStartSeq: 0 },
    obligations: null,
    readyForReview: false,
  };
}

function ref(id: string, kind: "path" | "thread", target: string, state: "included" | "excluded" | "suggested" = "included") {
  return { id, kind, target, state, by: "user", at: at(5) };
}

const archived = session("archived", { metadata: { ui: { archived: true } }, goal: "archived thread" });

describe("boundThreads", () => {
  it("omits archived threads and keeps the N most recent, newest first", () => {
    const many = Array.from({ length: CONTEXT_THREAD_BOUND + 5 }, (_, i) =>
      session(`s${i}`, { updatedAt: at(i) }),
    );
    const bound = boundThreads([archived, ...many], CONTEXT_THREAD_BOUND);
    expect(bound).toHaveLength(CONTEXT_THREAD_BOUND);
    expect(bound.map((s) => s.id)).toEqual(
      Array.from({ length: CONTEXT_THREAD_BOUND }, (_, i) => `s${CONTEXT_THREAD_BOUND + 4 - i}`),
    );
    expect(bound.some((s) => s.id === "archived")).toBe(false);
  });

  it("breaks recency ties deterministically by id", () => {
    const bound = boundThreads([session("b"), session("a")]);
    expect(bound.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("contextGraph", () => {
  it("draws only grounded edges whose endpoints exist", () => {
    const threads = [
      session("t1"),
      session("t2", { metadata: { subagent: { parentSessionId: "t1" } } }),
    ];
    const states = new Map([
      ["t1", state("t1", [ref("r1", "path", "src/main.go")])],
      ["t2", state("t2", [ref("r2", "path", "src/main.go", "suggested")])],
    ] as const);
    const g = contextGraph(threads, states);
    const ids = new Set(g.nodes.map((node) => node.id));
    for (const edge of g.edges) {
      expect(ids.has(edge.from)).toBe(true);
      expect(ids.has(edge.to)).toBe(true);
    }
  });

  it("never draws excluded references as edges", () => {
    const threads = [session("t1")];
    const states = new Map([
      ["t1", state("t1", [ref("r1", "path", "docs/old.md", "excluded"), ref("r2", "thread", "t9", "excluded")])],
    ] as const);
    const g = contextGraph(threads, states);
    expect(g.edges).toHaveLength(0);
    expect(g.nodes.map((node) => node.id)).toEqual(["t1"]);
  });

  it("omits archived threads entirely, even when referenced", () => {
    const threads = [session("t1")];
    const states = new Map([
      ["t1", state("t1", [ref("r1", "thread", "archived")])],
    ] as const);
    const g = contextGraph(boundThreads([archived, ...threads]), states);
    expect(g.nodes.map((node) => node.id)).toEqual(["t1"]);
    expect(g.edges).toHaveLength(0);
  });

  it("draws thread→file edges for included and suggested path references and marks the file", () => {
    const threads = [session("t1"), session("t2")];
    const states = new Map([
      ["t1", state("t1", [ref("r1", "path", "a.go", "included")])],
      ["t2", state("t2", [ref("r2", "path", "b.go", "suggested")])],
    ] as const);
    const g = contextGraph(threads, states);
    expect(g.edges).toEqual([
      expect.objectContaining({ kind: "includes", from: "t1", to: fileItem("a.go") }),
      expect.objectContaining({ kind: "suggests", from: "t2", to: fileItem("b.go") }),
    ]);
    const shared = contextGraph([session("t1")], new Map([
      ["t1", state("t1", [ref("r1", "path", "a.go", "included"), ref("r2", "path", "a.go", "suggested")])],
    ] as const));
    // One file node per path; the included reference wins over the suggestion.
    const fileNode = shared.nodes.find((node) => node.kind === "file");
    expect(fileNode).toMatchObject({ kind: "file", suggestedOnly: false });
    expect(shared.edges).toHaveLength(2);
  });

  it("draws thread→thread links for thread references and parent/child relations", () => {
    const child = session("child", { metadata: { subagent: { parentSessionId: "parent" } } });
    const threads = [session("parent"), child, session("peer")];
    const states = new Map([
      ["parent", state("parent", [ref("r1", "thread", "peer")])],
    ] as const);
    const g = contextGraph(threads, states);
    expect(g.edges).toEqual([
      expect.objectContaining({ kind: "child", from: "parent", to: "child" }),
      expect.objectContaining({ kind: "links", from: "parent", to: "peer" }),
    ]);
  });

  it("respects the loading bound: older threads beyond it are not nodes", () => {
    const many = Array.from({ length: 40 }, (_, i) => session(`s${String(i).padStart(2, "0")}`, { updatedAt: at(i) }));
    const bound = boundThreads(many);
    expect(bound).toHaveLength(CONTEXT_THREAD_BOUND);
    const g = contextGraph(bound, new Map());
    expect(g.nodes).toHaveLength(CONTEXT_THREAD_BOUND);
    // The oldest thread dropped out of the bound.
    expect(g.nodes.some((node) => node.id === "s00")).toBe(false);
  });

  it("counts files beyond the drawing bound instead of drawing them", () => {
    const threads = Array.from({ length: GRAPH_MAX_FILES + 1 }, (_, i) => session(`t${i}`));
    const states = new Map(
      threads.map((thread, i) => [
        thread.id,
        state(thread.id, [ref(`r${i}`, "path", `file-${i}.go`, "included")]),
      ] as const),
    );
    const g = contextGraph(threads, states);
    const files = g.nodes.filter((node) => node.kind === "file");
    expect(files).toHaveLength(GRAPH_MAX_FILES);
    expect(g.truncatedFiles).toBe(1);
  });

  it("marks finished threads from Task State resolution", () => {
    const g = contextGraph(
      [session("t1"), session("t2")],
      new Map([["t1", state("t1", [], "done")]] as const),
    );
    const byId = new Map(g.nodes.map((node) => [node.id, node]));
    expect(byId.get("t1")).toMatchObject({ kind: "thread", finished: true });
    expect(byId.get("t2")).toMatchObject({ kind: "thread", finished: false });
  });
});

describe("layoutGraph", () => {
  const threads = Array.from({ length: 4 }, (_, i) => session(`t${i}`));
  const states = new Map(
    threads.map((thread, i) => [
      thread.id,
      state(thread.id, [ref(`r${i}`, "path", `f${i}.go`, "included")]),
    ] as const),
  );
  const graph = contextGraph(threads, states);

  it("lays out deterministically without overlaps inside a column", () => {
    const a = layoutGraph(graph, 820);
    const b = layoutGraph(graph, 820);
    expect([...a.placed.values()].map((p) => [p.node.id, p.x, p.y])).toEqual(
      [...b.placed.values()].map((p) => [p.node.id, p.x, p.y]),
    );
    for (const col of [0, 1] as const) {
      const ps = [...a.placed.values()].filter((p) => p.node.col === col).sort((x, y) => x.y - y.y);
      for (let i = 1; i < ps.length; i++) {
        expect(ps[i].y - ps[i].h / 2).toBeGreaterThanOrEqual(ps[i - 1].y + ps[i - 1].h / 2);
      }
      for (const p of ps) {
        expect(p.y - p.h / 2).toBeGreaterThanOrEqual(0);
        expect(p.y + p.h / 2).toBeLessThanOrEqual(a.height);
      }
    }
  });

  it("keeps files in the right column and threads in the left", () => {
    const { placed } = layoutGraph(graph, 820);
    for (const p of placed.values()) {
      if (p.node.kind === "file") expect(p.node.col).toBe(1);
      else expect(p.node.col).toBe(0);
    }
  });
});

describe("neighborhood", () => {
  it("is the node plus its direct connections", () => {
    const threads = [session("t1"), session("t2")];
    const states = new Map([
      ["t1", state("t1", [ref("r1", "path", "a.go", "included"), ref("r2", "thread", "t2")])],
    ] as const);
    const g = contextGraph(threads, states);
    const near = neighborhood(g, "t1")!;
    expect(near.has("t1")).toBe(true);
    expect(near.has(fileItem("a.go"))).toBe(true);
    expect(near.has("t2")).toBe(true);
    expect(neighborhood(g, null)).toBeNull();
  });
});
