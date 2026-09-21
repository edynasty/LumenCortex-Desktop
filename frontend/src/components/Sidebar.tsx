import { Icon } from "./Icon";
import type { Copy } from "../i18n";
import type { Session } from "../types";
import { basename, statusText } from "../ui-utils";

type Props = {
  copy: Copy;
  locale: "zh" | "en";
  workspace: string;
  sessions: Session[];
  selected: string;
  query: string;
  activeRuns: Record<string, boolean>;
  open: boolean;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onPickWorkspace: () => void;
  onNewTask: () => void;
  onOpenSettings: () => void;
  onToggleLocale: () => void;
  onClose: () => void;
};

export function Sidebar({
  copy,
  locale,
  workspace,
  sessions,
  selected,
  query,
  activeRuns,
  open,
  onQuery,
  onSelect,
  onPickWorkspace,
  onNewTask,
  onOpenSettings,
  onToggleLocale,
  onClose,
}: Props) {
  return (
    <>
      <aside className={open ? "sidebar open" : "sidebar"}>
        <div className="sidebar-brand">
          <button className="logo-button" onClick={onNewTask} aria-label={copy.newTask}>
            <span className="logo-glyph"><Icon name="spark" size={15} /></span>
            <span className="logo-word">LumenCortex</span>
          </button>
        </div>

        <button className="new-task-button" onClick={onNewTask} disabled={!workspace}>
          <Icon name="plus" size={16} />
          <span>{copy.newTask}</span>
          <kbd>⌘N</kbd>
        </button>

        <button className="workspace-button" onClick={onPickWorkspace}>
          <span className="workspace-icon"><Icon name="folder" size={15} /></span>
          <span className="workspace-copy">
            <small>{copy.workspace}</small>
            <strong>{workspace ? basename(workspace) : copy.openWorkspace}</strong>
          </span>
          <Icon name="chevron" size={14} />
        </button>

        <div className="sidebar-search">
          <Icon name="search" size={14} />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={copy.search}
          />
          {query && (
            <button onClick={() => onQuery("")} aria-label={copy.clearSearch}>×</button>
          )}
        </div>

        <div className="sidebar-section-heading">
          <span>{copy.recent}</span>
          <span>{sessions.length}</span>
        </div>

        <div className="thread-list">
          {sessions.map((session) => (
            <button
              key={session.id}
              className={session.id === selected ? "thread-item active" : "thread-item"}
              onClick={() => onSelect(session.id)}
            >
              <span className={"thread-status " + (activeRuns[session.id] ? "running" : session.status)} />
              <span className="thread-copy">
                <strong>{session.goal}</strong>
                <small>
                  {statusText(copy, activeRuns[session.id] ? "running" : session.status)}
                  {" · "}
                  {session.id.slice(-6)}
                </small>
              </span>
            </button>
          ))}
          {!sessions.length && <div className="sidebar-empty">{copy.noSessions}</div>}
        </div>

        <div className="sidebar-footer">
          <button className="sidebar-footer-button" onClick={onOpenSettings}>
            <Icon name="sliders" size={15} />
            <span>{copy.settings}</span>
          </button>
          <button
            className="locale-button"
            onClick={onToggleLocale}
            title={copy.language}
          >
            <Icon name="globe" size={14} />
            <span>{locale === "zh" ? "EN" : "中文"}</span>
          </button>
        </div>
      </aside>

      {open && (
        <button
          className="mobile-backdrop sidebar-backdrop"
          onClick={onClose}
          aria-label={copy.hidePanel}
        />
      )}
    </>
  );
}
