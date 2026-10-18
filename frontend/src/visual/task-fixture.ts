import type { ExecutionTask, Message, Session, SubagentNode, TaskResult, ThreadTask } from "../types";

// The C3 scene: a thread whose turn ended (run status "completed") while its objective stays open,
// with one execution task in each state Core reports. Every value has Core's wire shape. The file
// imports no other fixture so fixture-data can read it without an import cycle.

const header = "[runtime] An execution task of this thread reached a terminal state. This reports its recorded state; it is not a user message.";
const worktrees = "/Users/demo/Projects/.lumencortex-worktrees";

export const taskSession: Session = {
  id: "session-demo",
  createdAt: "2026-09-22T01:00:00Z",
  updatedAt: "2026-09-22T02:00:00Z",
  status: "completed",
  provider: "openai",
  model: "gpt-5.6",
  goal: "Refactor provider settings and add tests without changing public behavior",
  final: "I proposed one task for the provider migration and started three isolated tasks. Review their results before applying anything.",
  metadata: { ui: { delegation: "propose" } },
};

function node(id: string, goal: string, status: string, active: boolean): SubagentNode {
  return {
    sessionId: id,
    parentSessionId: taskSession.id,
    kind: "execution",
    goal,
    status,
    active,
    createdAt: "2026-09-22T01:20:00Z",
    updatedAt: "2026-09-22T01:40:00Z",
    runtime: { kind: "worktree", path: `${worktrees}/${id}`, branch: `lumencortex/${id}`, base: "main", head: "98ab42f" },
  };
}

export const visualTasks: ThreadTask[] = [
  { id: "task-finished", objective: "Add regression tests for scope merging in provider_config.go", state: "started", sessionId: "task-a", proposedAt: "2026-09-22T01:10:00Z", startedAt: "2026-09-22T01:11:00Z" },
  { id: "task-failed", objective: "Migrate legacy provider notes into docs/configuration.md and delete the old file", state: "started", sessionId: "task-b", proposedAt: "2026-09-22T01:12:00Z", startedAt: "2026-09-22T01:12:30Z" },
  { id: "task-gate", objective: "Rename ProviderPane props to match the catalog wire names", state: "started", sessionId: "task-c", proposedAt: "2026-09-22T01:13:00Z", startedAt: "2026-09-22T01:13:30Z" },
  { id: "task-running", objective: "Extract the provider connection test into its own hook with focused unit tests", state: "started", sessionId: "task-d", proposedAt: "2026-09-22T01:14:00Z", startedAt: "2026-09-22T01:14:30Z" },
  { id: "task-proposed", objective: "Split ProviderSettingsPanel.tsx below the 350-line component threshold without changing behaviour", state: "proposed", proposedAt: "2026-09-22T01:30:00Z" },
];

export const visualTaskNodes: SubagentNode[] = [
  node("task-a", visualTasks[0].objective, "completed", false),
  node("task-b", visualTasks[1].objective, "failed", false),
  node("task-c", visualTasks[2].objective, "waiting_gate", false),
  node("task-d", visualTasks[3].objective, "running", true),
];

const results: TaskResult[] = [
  {
    taskId: "task-finished",
    sessionId: "task-a",
    objective: visualTasks[0].objective,
    status: "completed",
    final: "Added three table-driven tests covering global-only, project-only and merged scopes. go test ./internal/backend/... passes in the worktree.",
    checks: [{ id: "go-test", required: true, satisfied: true, status: "passed", provenance: "runtime" }],
    handoff: { branch: "lumencortex/task-a", path: `${worktrees}/task-a`, base: "main", head: "c41e7d2", exists: true, dirtyCount: 0, unappliedCommits: 1 },
  },
  {
    taskId: "task-failed",
    sessionId: "task-b",
    objective: visualTasks[1].objective,
    status: "failed",
    errorKind: "model",
    error: "provider returned 429 after 3 retries",
    openUnits: [{ id: "u2", goal: "Delete docs/legacy-provider-notes.md", status: "open" }],
    checks: [{ id: "go-test", required: true, satisfied: false, status: "pending" }],
    handoff: { branch: "lumencortex/task-b", path: `${worktrees}/task-b`, base: "main", exists: true, dirtyCount: 2, unappliedCommits: 0 },
  },
  {
    taskId: "task-gate",
    sessionId: "task-c",
    objective: visualTasks[2].objective,
    status: "waiting_gate",
    checks: null,
    handoff: { branch: "lumencortex/task-c", path: `${worktrees}/task-c`, base: "main", exists: true, dirtyCount: 3, unappliedCommits: 0 },
  },
];

function resultRow(seq: number, result: TaskResult): Message {
  return { sessionId: taskSession.id, seq, role: "user", json: { origin: "task_result", content: `${header}\n${JSON.stringify(result)}` } };
}

export const taskThreadMessages: Message[] = [
  { sessionId: taskSession.id, seq: 0, role: "user", json: { content: "Refactor provider settings and add tests. Split the work into tasks where it helps." } },
  { sessionId: taskSession.id, seq: 1, role: "assistant", json: { content: "I started three isolated tasks and proposed the component split for you to start." } },
  { sessionId: taskSession.id, seq: 4, role: "user", json: { origin: "turn", content: "Continue with the provider settings work." } },
  resultRow(5, results[0]),
  resultRow(6, results[1]),
  resultRow(7, results[2]),
];

// The stub's Core state: Task State's tasks and the SubagentTree, changed only by the two actions.
let tasksNow: ThreadTask[] = visualTasks;
let nodesNow: SubagentNode[] = visualTaskNodes;
export const visualTaskList = () => structuredClone(tasksNow);
export const visualTaskTree = () => structuredClone(nodesNow);

// StartProposedTask as Core answers it: the proposal becomes started with a new running child; a
// second Start of the same proposal is refused.
export function startVisualTask(taskId: string): ExecutionTask {
  const task = tasksNow.find((item) => item.id === taskId);
  if (!task) throw "task proposal not found";
  if (task.state !== "proposed") throw "task proposal was already started";
  const sessionId = "task-e";
  tasksNow = tasksNow.map((item) => (item.id === taskId ? { ...item, state: "started", sessionId, startedAt: new Date().toISOString() } : item));
  const child = node(sessionId, task.objective, "running", true);
  nodesNow = [...nodesNow, child];
  return { taskId, sessionId, parentSessionId: taskSession.id, base: "98ab42f", status: "created", runtime: child.runtime };
}

// CancelSubtree as Core answers it: the ids of the runs it cancelled, which end interrupted.
export function cancelVisualSubtree(sessionId: string): string[] {
  const ids = nodesNow.filter((item) => item.active && (sessionId === taskSession.id || item.sessionId === sessionId)).map((item) => item.sessionId);
  nodesNow = nodesNow.map((item) => (ids.includes(item.sessionId) ? { ...item, active: false, status: "interrupted" } : item));
  return ids;
}
