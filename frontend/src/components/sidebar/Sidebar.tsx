import {
  Blocks,
  ChevronRight,
  Folder,
  Languages,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Session } from "../../types";
import { ThreadRow } from "./ThreadRow";

export type SidebarThread = {
  session: Session;
  runtime: import("../../types").SessionRuntime;
  title: string;
  active: boolean;
  pinned: boolean;
  archived: boolean;
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
  extensionsActive: boolean;
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
    extensions: string;
    language: string;
    runtimeReady: string;
    runtimeOnline: string;
    runtimeOffline: string;
    renameThread: string;
    pinThread: string;
    unpinThread: string;
    archiveThread: string;
    restoreThread: string;
    save: string;
    cancel: string;
    threadMenu: string;
    localRuntime: string;
    worktreeRuntime: string;
  };
  onClose: () => void;
  onNewTask: () => void;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onPinSession: (sessionId: string, pinned: boolean) => void;
  onArchiveSession: (sessionId: string, archived: boolean) => void;
  onOpenProviders: () => void;
  onOpenExtensions: () => void;
  onSwitchLocale: () => void;
};

export function Sidebar({
  open,
  workspace,
  workspaceName,
  groups,
  recentProjects,
  selectedSessionId,
  providerActive,
  extensionsActive,
  runtimeState,
  runtimeVersion,
  labels,
  onClose,
  onNewTask,
  onPickWorkspace,
  onOpenWorkspace,
  onSelectSession,
  onRenameSession,
  onPinSession,
  onArchiveSession,
  onOpenProviders,
  onOpenExtensions,
  onSwitchLocale,
}: Props) {
  const [query, setQuery] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);
  const sessionCount = groups.reduce((total, group) => total + group.sessions.length, 0);
  const visibleGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return groups;
    return groups
      .map((group) => ({
        ...group,
        sessions: group.sessions.filter(({ session, title }) =>
          title.toLowerCase().includes(normalized) ||
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
        <button ref={closeButtonRef} className="icon-button mobile-only" onClick={onClose} aria-label={labels.close}>
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
            {group.sessions.map(({ session, runtime, title, active, pinned, archived, statusLabel }) => (
              <ThreadRow
                key={session.id}
                session={session}
                runtime={runtime}
                title={title}
                active={active}
                pinned={pinned}
                archived={archived}
                selected={session.id === selectedSessionId}
                statusLabel={statusLabel}
                labels={{
                  rename: labels.renameThread,
                  pin: labels.pinThread,
                  unpin: labels.unpinThread,
                  archive: labels.archiveThread,
                  restore: labels.restoreThread,
                  save: labels.save,
                  cancel: labels.cancel,
                  menu: labels.threadMenu,
                  localRuntime: labels.localRuntime,
                  worktreeRuntime: labels.worktreeRuntime,
                }}
                onSelect={() => onSelectSession(session.id)}
                onRename={(title) => onRenameSession(session.id, title)}
                onPinnedChange={(value) => onPinSession(session.id, value)}
                onArchivedChange={(value) => onArchiveSession(session.id, value)}
              />
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
        <button
          className={`footer-button ${extensionsActive ? "active" : ""}`}
          onClick={onOpenExtensions}
        >
          <Blocks size={14} strokeWidth={1.7} aria-hidden />
          <span>{labels.extensions}</span>
        </button>
        <button className="footer-button" onClick={onSwitchLocale}>
          <Languages size={14} strokeWidth={1.7} aria-hidden />
          <span>{labels.language}</span>
        </button>
      </div>
    </aside>
  );
}
