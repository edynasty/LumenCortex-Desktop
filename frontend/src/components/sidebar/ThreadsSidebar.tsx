/* Threads page body of the sidebar: New thread, filter, then grouped conversation rows. */
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { AppCopy, Locale } from "../../lib/i18n/app-copy";
import { formatRelative } from "../../lib/relative-time";
import { Icon } from "../primitives/Icon";
import type { SidebarGroup } from "./Sidebar";
import { ThreadRow } from "./ThreadRow";

type Props = {
  groups: SidebarGroup[];
  selectedSessionId: string;
  composing: boolean;
  locale: Locale;
  labels: AppCopy;
  onNewTask: () => void;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onPinSession: (sessionId: string, pinned: boolean) => void;
  onArchiveSession: (sessionId: string, archived: boolean) => void;
  onDeleteSession: (sessionId: string) => void;
};

function useNow(interval: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(timer);
  }, [interval]);
  return now;
}

export function ThreadsSidebar({
  groups,
  selectedSessionId,
  composing,
  locale,
  labels,
  onNewTask,
  onSelectSession,
  onRenameSession,
  onPinSession,
  onArchiveSession,
  onDeleteSession,
}: Props) {
  const [query, setQuery] = useState("");
  const normalized = useDeferredValue(query.trim().toLowerCase());
  const now = useNow(30_000);
  const sessionCount = groups.reduce((total, group) => total + group.sessions.length, 0);
  const visibleGroups = useMemo(() => {
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
  }, [groups, normalized]);

  const rowLabels = {
    rename: labels.renameThread,
    pin: labels.pinThread,
    unpin: labels.unpinThread,
    archive: labels.archiveThread,
    restore: labels.restoreThread,
    delete: labels.deleteThread,
    save: labels.save,
    cancel: labels.cancel,
    menu: labels.threadMenu,
  };

  return (
    <>
      <div className="sidebar-tools">
        <button type="button" className={`list-row new-thread-row ${composing ? "is-selected" : ""}`} aria-keyshortcuts="Meta+N Control+N" onClick={onNewTask}>
          <Icon name="newThread" size={15} />
          <span className="list-row-main">{labels.newTask}</span>
          <kbd className="kbd">⌘N</kbd>
        </button>
        <label className="search-field">
          <Icon name="search" size={13} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={labels.threadSearch} aria-label={labels.threadSearch} />
          {query && (
            <button type="button" className="icon-btn is-sm" aria-label={labels.clearFilter} title={labels.clearFilter} onClick={() => setQuery("")}>
              <Icon name="close" size={12} />
            </button>
          )}
        </label>
      </div>
      <nav className="sidebar-scroll thread-list" aria-label={labels.threadsPage}>
        {sessionCount === 0 && <p className="sidebar-empty">{labels.noSessions}</p>}
        {sessionCount > 0 && visibleGroups.length === 0 && <p className="sidebar-empty">{labels.noMatches}</p>}
        {visibleGroups.map((group) => (
          <section key={group.key} className={`thread-group group-${group.key}`}>
            <h3 className="section-label">{group.label}<span className="section-count">{group.sessions.length}</span></h3>
            {group.sessions.map((thread) => (
              <ThreadRow
                key={thread.session.id}
                session={thread.session}
                runtime={thread.runtime}
                title={thread.title}
                active={thread.active}
                pinned={thread.pinned}
                archived={thread.archived}
                selected={thread.session.id === selectedSessionId}
                statusLabel={thread.statusLabel}
                attentionTone={thread.attentionTone}
                time={formatRelative(thread.session.updatedAt, now, locale)}
                labels={rowLabels}
                onSelect={() => onSelectSession(thread.session.id)}
                onRename={(title) => onRenameSession(thread.session.id, title)}
                onPinnedChange={(value) => onPinSession(thread.session.id, value)}
                onArchivedChange={(value) => onArchiveSession(thread.session.id, value)}
                onDelete={() => onDeleteSession(thread.session.id)}
              />
            ))}
          </section>
        ))}
      </nav>
    </>
  );
}
