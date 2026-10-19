/*
 * Global rail: the top-level pages plus Settings. It never collapses on a docked window, so
 * navigation stays in one place while the contextual sidebar next to it opens, closes and resizes.
 */
import type { WorkspacePage } from "../../app/workspace-route";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { Icon } from "../primitives/Icon";
import type { IconName } from "../primitives/icons";

type Props = {
  page: WorkspacePage;
  settingsOpen: boolean;
  /** Threads that need the user (gate, failure, interruption). Shown as a count. */
  attention: number;
  /** Worktree sessions on this project. Shown as a quiet dot. */
  worktrees: number;
  labels: AppCopy;
  onNavigate: (page: WorkspacePage) => void;
  onOpenSettings: () => void;
};

export function Rail({ page, settingsOpen, attention, worktrees, labels, onNavigate, onOpenSettings }: Props) {
  const items: { page: WorkspacePage; icon: IconName; label: string; hint: string; count?: number; dot?: boolean }[] = [
    { page: "threads", icon: "discussion", label: labels.threadsPage, hint: `${labels.threadsPage} ⌘1`, count: attention },
    { page: "context", icon: "context", label: labels.contextPage, hint: `${labels.contextPage} ⌘2` },
    { page: "scm", icon: "worktree", label: labels.sourceControl, hint: `${labels.sourceControl} ⌘3`, dot: worktrees > 0 },
    { page: "agents", icon: "agents", label: labels.agentsPage, hint: `${labels.agentsPage} ⌘4` },
  ];
  return (
    <nav className="rail" aria-label={labels.mainNav}>
      <div className="rail-items">
        {items.map((item) => {
          const active = page === item.page && !settingsOpen;
          return (
            <button
              key={item.page}
              type="button"
              className={`rail-btn ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              aria-label={item.count ? `${item.label} (${item.count})` : item.label}
              title={item.hint}
              onClick={() => onNavigate(item.page)}
            >
              <Icon name={item.icon} size={19} />
              {item.count ? <span className="rail-badge is-count" aria-hidden>{item.count > 9 ? "9+" : item.count}</span> : null}
              {!item.count && item.dot ? <span className="rail-badge is-dot" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
      <div className="rail-items">
        <button
          type="button"
          className={`rail-btn ${settingsOpen ? "is-active" : ""}`}
          aria-label={labels.settings}
          title={`${labels.settings} ⌘,`}
          onClick={onOpenSettings}
        >
          <Icon name="settings" size={19} />
        </button>
      </div>
    </nav>
  );
}
