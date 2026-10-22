/*
 * Contextual sidebar frame. The project it scopes sits on top and the page's own list fills the
 * middle (threads, Source Control, Context). The global rail owns navigation, so the sidebar
 * never repeats it or reserves space for low-value runtime telemetry.
 */
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { Icon } from "../primitives/Icon";
import { basename, ProjectMenu } from "./ProjectMenu";
import type { Session, SessionRuntime } from "../../types";

export type SidebarThread = {
  session: Session;
  runtime: SessionRuntime;
  title: string;
  active: boolean;
  pinned: boolean;
  archived: boolean;
  attentionTone?: "warning" | "danger";
  statusLabel: string;
};

export type SidebarGroup = {
  key: string;
  label: string;
  sessions: SidebarThread[];
};

export type RuntimeState = "ready" | "online" | "offline";

function ProjectSwitcher({ workspace, recentProjects, labels, onPickWorkspace, onOpenWorkspace }: {
  workspace: string;
  recentProjects: string[];
  labels: AppCopy;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const name = workspace ? basename(workspace) : labels.openProject;

  // Arrow keys open the menu like a native one; Enter/Space keep the click path.
  const onTriggerKeyDown = (event: ReactKeyboardEvent) => {
    if (open || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    setOpen(true);
  };

  return (
    <div className="project-switcher">
      <button
        ref={triggerRef}
        type="button"
        className="project-button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={workspace}
        onClick={() => setOpen(!open)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="project-avatar" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>
        <span className="project-text">
          <span className="project-name">{name}</span>
          {workspace && <span className="project-branch"><span>{workspace}</span></span>}
        </span>
        <Icon name="collapse" size={14} className="project-chevron" />
      </button>
      <ProjectMenu
        open={open}
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
        workspace={workspace}
        recentProjects={recentProjects}
        labels={labels}
        onPickWorkspace={onPickWorkspace}
        onOpenWorkspace={onOpenWorkspace}
      />
    </div>
  );
}

type Props = {
  label: string;
  workspace: string;
  recentProjects: string[];
  labels: AppCopy;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
  children: ReactNode;
};

export function Sidebar({ label, workspace, recentProjects, labels, onPickWorkspace, onOpenWorkspace, children }: Props) {
  return (
    <aside className="sidebar" aria-label={label}>
      <ProjectSwitcher workspace={workspace} recentProjects={recentProjects} labels={labels} onPickWorkspace={onPickWorkspace} onOpenWorkspace={onOpenWorkspace} />
      <div className="sidebar-body">{children}</div>
    </aside>
  );
}
