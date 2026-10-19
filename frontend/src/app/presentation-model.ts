import type { SidebarGroup } from "../components/sidebar/Sidebar";
import { sessionRuntime } from "../lib/session-runtime";
import { isRunningElsewhere } from "../lib/session-status";
import { sessionUI } from "../lib/session-ui";
import type { ComponentProps } from "react";
import type { ThreadWorkspace } from "../components/thread/ThreadWorkspace";
import type { AppCopy } from "../lib/i18n/app-copy";
import type { Session } from "../types";

export type SessionStatusLabels = {
  active: string;
  created: string;
  completed: string;
  interrupted: string;
  waiting: string;
  runningElsewhere: string;
  unknown: string;
  failed: string;
};

type SidebarLabels = SessionStatusLabels & {
  runningThreads: string;
  attentionThreads: string;
  pinnedThreads: string;
  recentThreads: string;
  archivedThreads: string;
};

type SidebarGroupsInput = {
  sessions: Session[];
  activeRunIds: Set<string>;
  workspace: string;
  labels: SidebarLabels;
};

// The label comes from the durable status. `isRunning` means this process runs the
// session; a durably running session it does not run is running elsewhere.
export function sessionStatusLabel(labels: SessionStatusLabels, status?: string, isRunning = false): string {
  if (isRunning) return labels.active;
  switch (status) {
    case "created": return labels.created;
    case "completed": return labels.completed;
    case "interrupted": return labels.interrupted;
    case "waiting_gate": return labels.waiting;
    case "running": return labels.runningElsewhere;
    case "failed": return labels.failed;
    default: return status || labels.unknown;
  }
}

export function buildSidebarGroups({
  sessions,
  activeRunIds,
  workspace,
  labels,
}: SidebarGroupsInput): SidebarGroup[] {
  const runningThreads: SidebarGroup["sessions"] = [];
  const attentionThreads: SidebarGroup["sessions"] = [];
  const pinnedThreads: SidebarGroup["sessions"] = [];
  const recentThreads: SidebarGroup["sessions"] = [];
  const archivedThreads: SidebarGroup["sessions"] = [];

  for (const session of sessions) {
    const ui = sessionUI(session);
    if (ui.parentSessionId) continue;
    const active = activeRunIds.has(session.id);
    const attentionTone =
      !active && session.status === "waiting_gate"
        ? "warning" as const
        : !active && (session.status === "failed" || session.status === "interrupted")
          ? "danger" as const
          : undefined;
    const elsewhere = isRunningElsewhere(session.status, active);
    const thread = {
      session,
      runtime: sessionRuntime(session, workspace),
      title: ui.title,
      active,
      pinned: ui.pinned,
      archived: ui.archived,
      attentionTone,
      statusLabel: sessionStatusLabel(labels, session.status, active),
    };

    if (ui.archived) {
      archivedThreads.push(thread);
    } else if (active || elsewhere) {
      runningThreads.push(thread);
    } else if (attentionTone) {
      attentionThreads.push(thread);
    } else if (ui.pinned) {
      pinnedThreads.push(thread);
    } else {
      recentThreads.push(thread);
    }
  }

  return [
    { key: "attention", label: labels.attentionThreads, sessions: attentionThreads },
    { key: "running", label: labels.runningThreads, sessions: runningThreads },
    { key: "pinned", label: labels.pinnedThreads, sessions: pinnedThreads },
    { key: "recent", label: labels.recentThreads, sessions: recentThreads },
    { key: "archived", label: labels.archivedThreads, sessions: archivedThreads },
  ].filter((group) => group.sessions.length > 0);
}

// threadWorkspaceLabels maps the app copy onto the thread view's labels; noModels is the picker's
// placeholder, which depends on the configuration.
export function threadWorkspaceLabels(labels: AppCopy, noModels: string): ComponentProps<typeof ThreadWorkspace>["labels"] {
  return {
    newTask: labels.newTask,
    running: labels.running,
    noMessages: labels.noMessages,
    finalAnswer: labels.finalAnswer,
    start: labels.start,
    roleUser: labels.messageRoleUser,
    roleAssistant: labels.messageRoleAssistant,
    roleTool: labels.messageRoleTool,
    roleSystem: labels.messageRoleSystem,
    approvalTitle: labels.approvalTitle,
    approve: labels.approve,
    loadEarlier: labels.loadEarlier,
    backToLatest: labels.backToLatest,
    historyWindow: labels.historyWindow,
    localRuntime: labels.localRuntime,
    worktreeRuntime: labels.worktreeRuntime,
    plan: labels.plan,
    planRunning: labels.planRunning,
    planWaiting: labels.planWaiting,
    planSubagents: labels.planSubagents,
    copy: labels.copy,
    copied: labels.copied,
    retry: labels.retry,
    failureTitle: labels.error,
    workTitle: labels.workTitle,
    workCalls: labels.workCalls,
    showOutput: labels.showOutput,
    hideOutput: labels.hideOutput,
    runningElsewhereNotice: labels.runningElsewhereNotice,
    runtimeNotice: labels.runtimeNotice,
    originToolInterrupted: labels.originToolInterrupted,
    originToolInterruptedBody: labels.originToolInterruptedBody,
    originCompletionBlocked: labels.originCompletionBlocked,
    originResume: labels.originResume,
    originTurn: labels.originTurn,
  };
}
