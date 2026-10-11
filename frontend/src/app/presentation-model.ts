import type { SidebarGroup } from "../components/sidebar/Sidebar";
import { sessionRuntime } from "../lib/session-runtime";
import { isRunningElsewhere } from "../lib/session-status";
import { sessionUI } from "../lib/session-ui";
import type { ProviderCatalog, ProviderSecretStatus, Session } from "../types";

export type ConfiguredModelOption = {
  ref: string;
  label: string;
  group: string;
  description: string;
  isDefault: boolean;
  missingSecret: boolean;
};

export function providerModelOptions(
  catalog: ProviderCatalog,
  secretStatuses: Record<string, ProviderSecretStatus> = {},
): ConfiguredModelOption[] {
  return Object.entries(catalog.providers || {}).flatMap(([providerID, provider]) =>
    Object.entries(provider.models || {}).map(([modelID, definition]) => {
      const ref = providerID + "/" + modelID;
      const metadata = [
        definition.modelID && definition.modelID !== modelID ? definition.modelID : "",
        definition.limit?.context ? Math.round(definition.limit.context / 1024) + "K ctx" : "",
        definition.limit?.output ? Math.round(definition.limit.output / 1024) + "K out" : "",
      ].filter(Boolean).join(" · ");
      return {
        ref,
        label: definition.name || modelID,
        group: provider.name || providerID,
        description: metadata,
        isDefault: catalog.model === ref,
        missingSecret:
          secretStatuses[providerID]?.configured === true &&
          secretStatuses[providerID]?.available === false,
      };
    }),
  );
}

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
    { key: "running", label: labels.runningThreads, sessions: runningThreads },
    { key: "attention", label: labels.attentionThreads, sessions: attentionThreads },
    { key: "pinned", label: labels.pinnedThreads, sessions: pinnedThreads },
    { key: "recent", label: labels.recentThreads, sessions: recentThreads },
    { key: "archived", label: labels.archivedThreads, sessions: archivedThreads },
  ].filter((group) => group.sessions.length > 0);
}
