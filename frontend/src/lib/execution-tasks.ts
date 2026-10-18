import type { Delegation, Message, SubagentNode, TaskResult, ThreadTask } from "../types";

// How a task card presents an execution task (ADR-0006 D4). Task State says whether the task was
// proposed or started; the child's run status comes from SubagentTree. A run that ended "completed"
// is "finished": the objective is not done until the user reviews it.
export type TaskPhase =
  | "proposed"
  | "starting"
  | "running"
  | "running_elsewhere"
  | "waiting_gate"
  | "interrupted"
  | "failed"
  | "finished"
  | "unknown";

export function findNode(nodes: SubagentNode[], sessionId: string): SubagentNode | undefined {
  for (const node of nodes) {
    if (node.sessionId === sessionId) return node;
    const child = node.children ? findNode(node.children, sessionId) : undefined;
    if (child) return child;
  }
  return undefined;
}

export function taskPhase(task: ThreadTask, node: SubagentNode | undefined): TaskPhase {
  if (task.state === "proposed") return "proposed";
  if (!node) return "unknown";
  if (node.active) return "running";
  switch (node.status) {
    case "created": return "starting";
    // Durably running but not run by this process: another process owns it.
    case "running": return "running_elsewhere";
    case "waiting_gate": return "waiting_gate";
    case "interrupted": return "interrupted";
    case "failed": return "failed";
    case "completed": return "finished";
    default: return "unknown";
  }
}

// The nodes of a subtree this process runs, and those that run in another process, which
// CancelSubtree cannot reach.
export function runningNodes(nodes: SubagentNode[]): { here: SubagentNode[]; elsewhere: SubagentNode[] } {
  const here: SubagentNode[] = [];
  const elsewhere: SubagentNode[] = [];
  const walk = (list: SubagentNode[]) => {
    for (const node of list) {
      if (node.active) here.push(node);
      else if (node.status === "running") elsewhere.push(node);
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return { here, elsewhere };
}

function payloadOf(message: Message): Record<string, unknown> | null {
  let value = message.json;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

// A task_result row is Core's header line, a newline, then the TaskResult JSON.
export function taskResultOf(message: Message): TaskResult | null {
  const payload = payloadOf(message);
  if (!payload || payload.origin !== "task_result" || typeof payload.content !== "string") return null;
  const newline = payload.content.indexOf("\n");
  if (newline < 0) return null;
  try {
    const result = JSON.parse(payload.content.slice(newline + 1)) as TaskResult;
    return result && typeof result.sessionId === "string" ? result : null;
  } catch {
    return null;
  }
}

// The newest delivered result of each child among the loaded messages.
export function latestTaskResults(messages: Message[]): Map<string, TaskResult> {
  const out = new Map<string, TaskResult>();
  for (const message of messages) {
    const result = taskResultOf(message);
    if (result) out.set(result.sessionId, result);
  }
  return out;
}

export type Verification = "passed" | "failed" | "pending" | "none" | "error";

// Verification from the result's required checks at the worktree's state when it was delivered.
export function verification(result: TaskResult): Verification {
  if (result.checksError) return "error";
  const required = (result.checks ?? []).filter((check) => check.required);
  if (required.length === 0) return "none";
  if (required.every((check) => check.satisfied)) return "passed";
  if (required.some((check) => check.status === "failed")) return "failed";
  return "pending";
}

export function delegationOf(value: unknown): Delegation {
  return value === "propose" || value === "isolated" ? value : "none";
}
