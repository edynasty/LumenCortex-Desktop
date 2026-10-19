/*
 * Contextual sidebar frame. The project it scopes sits on top, the page's own list fills the
 * middle (threads, Source Control, Context), Core status sits at the bottom. The global rail
 * beside it owns navigation, so the sidebar never repeats it.
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
  runtimeState: RuntimeState;
  runtimeVersion?: string;
  activeRuns: number;
  labels: AppCopy;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
  children: ReactNode;
};

export function Sidebar({ label, workspace, recentProjects, runtimeState, runtimeVersion, activeRuns, labels, onPickWorkspace, onOpenWorkspace, children }: Props) {
  const runtimeLabel = runtimeState === "online" ? labels.runtimeOnline : runtimeState === "offline" ? labels.runtimeOffline : labels.runtimeReady;
  return (
    <aside className="sidebar" aria-label={label}>
      <ProjectSwitcher workspace={workspace} recentProjects={recentProjects} labels={labels} onPickWorkspace={onPickWorkspace} onOpenWorkspace={onOpenWorkspace} />
      <div className="sidebar-body">{children}</div>
      <footer className="sidebar-footer">
        <span className="core-status" title={runtimeVersion ? `LumenCortex Core ${runtimeVersion}` : "LumenCortex Core"}>
          <span className={`core-dot is-${runtimeState} ${activeRuns ? "is-busy" : ""}`} aria-hidden />
          <span>{runtimeLabel}</span>
          <span className="core-runs">{activeRuns ? labels.runsActive.replace("{n}", String(activeRuns)) : labels.noRuns}</span>
        </span>
      </footer>
    </aside>
  );
}
