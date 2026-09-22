import type { RuntimeEvent } from "../../types";

export type MilestoneKind = "run" | "tool" | "approval" | "subagent" | "worktree" | "result";

export type Milestone = {
  key: string;
  at: string;
  kind: MilestoneKind;
  title: string;
  detail?: string;
  state?: "active" | "success" | "warning";
};

type Labels = {
  agentStarted: string;
  agentStopped: string;
  toolCompleted: string;
  approvalRequired: string;
  approvalGranted: string;
  subagentStarted: string;
  subagentStopped: string;
  worktreeCreated: string;
  worktreeApplied: string;
  taskCompleted: string;
  taskInterrupted: string;
  workflowAdvanced: string;
};

function text(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function toolDetail(event: RuntimeEvent) {
  const data = event.data || {};
  const name = text(data.name);
  const command = text(data.command);
  const path = text(data.path);
  const exitCode = data.exitCode;
  return [name, command || path, typeof exitCode === "number" ? `exit ${exitCode}` : ""]
    .filter(Boolean)
    .join(" · ");
}

export function milestonesFromEvents(events: RuntimeEvent[], labels: Labels, limit = 80): Milestone[] {
  const milestones: Milestone[] = [];
  for (const event of events) {
    const data = event.data || {};
    let item: Milestone | null = null;
    switch (event.type) {
      case "run.started":
        item = { key: String(event.seq), at: event.at, kind: "run", title: labels.agentStarted, state: "active" };
        break;
      case "run.stopped":
        item = { key: String(event.seq), at: event.at, kind: "run", title: labels.agentStopped, state: data.error ? "warning" : "success", detail: text(data.error) };
        break;
      case "tool.end":
        item = { key: String(event.seq), at: event.at, kind: "tool", title: labels.toolCompleted, detail: toolDetail(event), state: data.error || (typeof data.exitCode === "number" && data.exitCode !== 0) ? "warning" : "success" };
        break;
      case "workflow.transition":
        item = { key: String(event.seq), at: event.at, kind: "run", title: labels.workflowAdvanced, detail: text(data.title) || text(data.action) };
        break;
      case "workflow.gate_waiting":
        item = { key: String(event.seq), at: event.at, kind: "approval", title: labels.approvalRequired, detail: text(data.title), state: "warning" };
        break;
      case "workflow.approved":
        item = { key: String(event.seq), at: event.at, kind: "approval", title: labels.approvalGranted, detail: text(data.title), state: "success" };
        break;
      case "subagent.spawned":
        item = { key: String(event.seq), at: event.at, kind: "subagent", title: labels.subagentStarted, detail: text(data.goal), state: "active" };
        break;
      case "subagent.stopped":
        item = { key: String(event.seq), at: event.at, kind: "subagent", title: labels.subagentStopped, detail: text(data.status) || text(data.error), state: data.error ? "warning" : "success" };
        break;
      case "worktree.created":
        item = { key: String(event.seq), at: event.at, kind: "worktree", title: labels.worktreeCreated, detail: text(data.branch) || text(data.path), state: "success" };
        break;
      case "worktree.applied":
        item = { key: String(event.seq), at: event.at, kind: "worktree", title: labels.worktreeApplied, detail: text(data.branch), state: "success" };
        break;
      case "session.complete":
        item = { key: String(event.seq), at: event.at, kind: "result", title: labels.taskCompleted, state: "success" };
        break;
      case "session.interrupted":
        item = { key: String(event.seq), at: event.at, kind: "result", title: labels.taskInterrupted, detail: text(data.error), state: "warning" };
        break;
    }
    if (item) milestones.push(item);
  }
  return milestones.slice(-Math.max(1, limit));
}
