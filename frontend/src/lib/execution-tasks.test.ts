import { describe, expect, it } from "vitest";
import type { Message, SubagentNode, TaskResult, ThreadTask } from "../types";
import { latestTaskResults, runningNodes, taskPhase, taskResultOf, verification } from "./execution-tasks";

const header = "[runtime] An execution task of this thread reached a terminal state. This reports its recorded state; it is not a user message.";

function node(over: Partial<SubagentNode>): SubagentNode {
  return {
    sessionId: "c1",
    kind: "execution",
    goal: "g",
    status: "running",
    active: false,
    createdAt: "",
    updatedAt: "",
    runtime: { kind: "worktree" } as SubagentNode["runtime"],
    ...over,
  };
}

function resultRow(seq: number, result: Partial<TaskResult>): Message {
  return {
    sessionId: "p",
    seq,
    role: "user",
    json: { role: "user", origin: "task_result", content: header + "\n" + JSON.stringify({ sessionId: "c1", objective: "o", status: "completed", checks: [], ...result }) },
  };
}

const started: ThreadTask = { id: "t1", objective: "o", state: "started", sessionId: "c1" };

describe("taskPhase", () => {
  it("keeps a proposal a proposal until Core reports it started", () => {
    expect(taskPhase({ id: "t1", objective: "o", state: "proposed" }, undefined)).toBe("proposed");
    // A child that exists does not make a proposal running: Task State says what was started.
    expect(taskPhase({ id: "t1", objective: "o", state: "proposed" }, node({ active: true }))).toBe("proposed");
  });

  it("separates each run status; a completed run is only finished", () => {
    expect(taskPhase(started, node({ active: true }))).toBe("running");
    expect(taskPhase(started, node({ status: "running" }))).toBe("running_elsewhere");
    expect(taskPhase(started, node({ status: "waiting_gate" }))).toBe("waiting_gate");
    expect(taskPhase(started, node({ status: "interrupted" }))).toBe("interrupted");
    expect(taskPhase(started, node({ status: "failed" }))).toBe("failed");
    expect(taskPhase(started, node({ status: "completed" }))).toBe("finished");
    expect(taskPhase(started, undefined)).toBe("unknown");
  });
});

describe("runningNodes", () => {
  it("separates runs this process can stop from runs held elsewhere, through the whole tree", () => {
    const tree = [
      node({ sessionId: "a", active: true, children: [node({ sessionId: "a1", status: "running" })] }),
      node({ sessionId: "b", status: "completed" }),
    ];
    const { here, elsewhere } = runningNodes(tree);
    expect(here.map((n) => n.sessionId)).toEqual(["a"]);
    expect(elsewhere.map((n) => n.sessionId)).toEqual(["a1"]);
  });
});

describe("task results", () => {
  it("parses the row after its header and ignores other rows", () => {
    expect(taskResultOf(resultRow(3, { status: "interrupted" }))?.status).toBe("interrupted");
    expect(taskResultOf({ sessionId: "p", seq: 1, role: "user", json: { content: "hi" } })).toBeNull();
    expect(taskResultOf({ sessionId: "p", seq: 1, role: "user", json: { origin: "task_result", content: header + "\n{" } })).toBeNull();
  });

  it("keeps the newest delivered transition of each child", () => {
    const results = latestTaskResults([resultRow(3, { status: "interrupted" }), resultRow(9, { status: "completed" })]);
    expect(results.get("c1")?.status).toBe("completed");
  });

  it("reports verification from required checks only", () => {
    const base = { sessionId: "c1", objective: "o", status: "completed" };
    expect(verification({ ...base, checks: [] })).toBe("none");
    expect(verification({ ...base, checks: [{ id: "lint", required: false, satisfied: false, status: "failed" }] })).toBe("none");
    expect(verification({ ...base, checks: [{ id: "t", required: true, satisfied: true, status: "passed" }] })).toBe("passed");
    expect(verification({ ...base, checks: [{ id: "t", required: true, satisfied: false, status: "failed" }] })).toBe("failed");
    expect(verification({ ...base, checks: [{ id: "t", required: true, satisfied: false, status: "pending" }] })).toBe("pending");
    expect(verification({ ...base, checks: null, checksError: "boom" })).toBe("error");
  });
});
