import {
  ChevronRight,
  Folder,
  Languages,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Session } from "../../types";

export type SidebarThread = {
  session: Session;
  active: boolean;
  statusLabel: string;
};

export type SidebarGroup = {
  key: string;
  label: string;
  sessions: SidebarThread[];
};

type RuntimeState = "ready" | "online" | "offline";

type Props = {
  open: boolean;
  workspace: string;
  workspaceName: string;
  groups: SidebarGroup[];
  recentProjects: string[];
  selectedSessionId: string;
  providerActive: boolean;
  runtimeState: RuntimeState;
  runtimeVersion?: string;
  labels: {
    close: string;
    newTask: string;
    project: string;
    openProject: string;
    sessions: string;
    noSessions: string;
    threadSearch: string;
    recentProjects: string;
    providerSettings: string;
    language: string;
    runtimeReady: string;
    runtimeOnline: string;
    runtimeOffline: string;
  };
  onClose: () => void;
  onNewTask: () => void;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
  onSelectSession: (sessionId: string) => void;
  onOpenProviders: () => void;
  onSwitchLocale: () => void;
};

function formatClock(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function Sidebar({
  open,
  workspace,
  workspaceName,
  groups,
  recentProjects,
  selectedSessionId,
  providerActive,
  runtimeState,
  runtimeVersion,
  labels,
  onClose,
  onNewTask,
  onPickWorkspace,
  onOpenWorkspace,
  onSelectSession,
  onOpenProviders,
  onSwitchLocale,
}: Props) {
  const [query, setQuery] = useState("");
  const sessionCount = groups.reduce((total, group) => total + group.sessions.length, 0);
  const visibleGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return groups;
    return groups
      .map((group) => ({
        ...group,
        sessions: group.sessions.filter(({ session }) =>
          session.goal.toLowerCase().includes(normalized) ||
          session.provider?.toLowerCase().includes(normalized) ||
          session.model?.toLowerCase().includes(normalized)
        ),
      }))
      .filter((group) => group.sessions.length > 0);
  }, [groups, query]);
  const runtimeLabel =
    runtimeState === "online"
      ? labels.runtimeOnline
      : runtimeState === "offline"
        ? labels.runtimeOffline
        : labels.runtimeReady;

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-head">
        <div className="brand-mark" aria-hidden>LC</div>
        <div className="brand-copy">
          <strong>LumenCortex</strong>
          <span>Desktop</span>
        </div>
        <button className="icon-button mobile-only" onClick={onClose} aria-label={labels.close}>
          <X size={16} strokeWidth={1.7} aria-hidden />
        </button>
      </div>

      <button className="new-task-button" onClick={onNewTask}>
        <Plus size={15} strokeWidth={1.7} aria-hidden />
        <span>{labels.newTask}</span>
      </button>

      <button className="project-button" onClick={onPickWorkspace}>
        <span className="project-icon"><Folder size={16} strokeWidth={1.7} aria-hidden /></span>
        <span className="project-copy">
          <small>{labels.project}</small>
          <strong>{workspace ? workspaceName : labels.openProject}</strong>
        </span>
        <ChevronRight size={14} strokeWidth={1.7} aria-hidden />
      </button>

      {recentProjects.length > 0 && (
        <div className="recent-projects">
          <span>{labels.recentProjects}</span>
          {recentProjects.filter((path) => path !== workspace).slice(0, 4).map((path) => (
            <button key={path} type="button" onClick={() => onOpenWorkspace(path)} title={path}>
              <Folder size={12} strokeWidth={1.7} aria-hidden />
              <span>{path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path}</span>
            </button>
          ))}
        </div>
      )}

      <label className="thread-search">
        <Search size={13} strokeWidth={1.7} aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={labels.threadSearch}
          aria-label={labels.threadSearch}
        />
      </label>

      <div className="sidebar-section-title sidebar-section-summary">
        <span>{labels.sessions}</span>
        <span>{sessionCount}</span>
      </div>

      <div className="thread-list">
        {visibleGroups.map((group) => (
          <section className="thread-group" key={group.key}>
            <div className="thread-group-title">
              <span>{group.label}</span>
              <span>{group.sessions.length}</span>
            </div>
            {group.sessions.map(({ session, active, statusLabel }) => (
              <button
                key={session.id}
                className={`thread-item ${session.id === selectedSessionId ? "selected" : ""}`}
                onClick={() => onSelectSession(session.id)}
              >
                <span className={`thread-dot ${active ? "live" : session.status}`} />
                <span className="thread-copy">
                  <strong>{session.goal}</strong>
                  <small>{statusLabel} · {formatClock(session.updatedAt)}</small>
                </span>
              </button>
            ))}
          </section>
        ))}
        {!sessionCount && <div className="sidebar-empty">{labels.noSessions}</div>}
        {sessionCount > 0 && !visibleGroups.length && <div className="sidebar-empty">{labels.noSessions}</div>}
      </div>

      <div className="sidebar-footer">
        <div className="runtime-line">
          <span className={`runtime-dot ${runtimeState}`} />
          <span>{runtimeLabel}</span>
          {runtimeVersion && <code>{runtimeVersion}</code>}
        </div>
        <button
          className={`footer-button provider-settings-entry ${providerActive ? "active" : ""}`}
          onClick={onOpenProviders}
        >
          <Settings2 size={14} strokeWidth={1.7} aria-hidden />
          <span>{labels.providerSettings}</span>
        </button>
        <button className="footer-button" onClick={onSwitchLocale}>
          <Languages size={14} strokeWidth={1.7} aria-hidden />
          <span>{labels.language}</span>
        </button>
      </div>
    </aside>
  );
}
