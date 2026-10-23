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

type SwitcherProps = {
  workspace: string;
  recentProjects: string[];
  /** Recent projects whose directory is gone; greyed in the menu and removable. */
  missingProjects?: string[];
  onRemoveRecentProject?: (path: string) => void;
  labels: AppCopy;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
};

function ProjectSwitcher({ workspace, recentProjects, missingProjects = [], onRemoveRecentProject, labels, onPickWorkspace, onOpenWorkspace }: SwitcherProps) {
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
        missingProjects={missingProjects}
        onRemoveProject={onRemoveRecentProject}
        labels={labels}
        onPickWorkspace={onPickWorkspace}
        onOpenWorkspace={onOpenWorkspace}
      />
    </div>
  );
}

type Props = SwitcherProps & {
  label: string;
  children: ReactNode;
};

export function Sidebar({ label, children, ...switcher }: Props) {
  return (
    <aside className="sidebar" aria-label={label}>
      <ProjectSwitcher {...switcher} />
      <div className="sidebar-body">{children}</div>
    </aside>
  );
}
