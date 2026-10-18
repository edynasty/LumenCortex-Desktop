/*
 * Contextual sidebar frame. The project it scopes sits on top, the page's own list fills the
 * middle (threads, Source Control, Context), Core status sits at the bottom. The global rail
 * beside it owns navigation, so the sidebar never repeats it.
 */
import { useState, type ReactNode } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { AnchoredPopover } from "../primitives/AnchoredPopover";
import { Icon } from "../primitives/Icon";
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

function basename(path: string) {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
}

function ProjectSwitcher({ workspace, recentProjects, labels, onPickWorkspace, onOpenWorkspace }: {
  workspace: string;
  recentProjects: string[];
  labels: AppCopy;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const name = workspace ? basename(workspace) : labels.openProject;
  return (
    <div className="project-switcher popover-anchor">
      <button type="button" className="project-button" aria-haspopup="dialog" aria-expanded={open} title={workspace} onClick={() => setOpen(!open)}>
        <span className="project-avatar" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>
        <span className="project-text">
          <span className="project-name">{name}</span>
          {workspace && <span className="project-branch"><span>{workspace}</span></span>}
        </span>
        <Icon name="collapse" size={14} className="project-chevron" />
      </button>
      <AnchoredPopover open={open} onClose={() => setOpen(false)} label={labels.recentProjects} className="menu project-menu">
        {recentProjects.length > 0 && <div className="menu-label">{labels.recentProjects}</div>}
        {recentProjects.slice(0, 8).map((path) => (
          <button key={path} type="button" className="menu-item" aria-checked={path === workspace} onClick={() => { setOpen(false); if (path !== workspace) onOpenWorkspace(path); }}>
            <Icon name="project" size={15} />
            <span className="menu-item-body"><span>{basename(path)}</span><span className="menu-item-sub mono">{path}</span></span>
            {path === workspace && <Icon name="checkmark" size={14} className="menu-check" />}
          </button>
        ))}
        {recentProjects.length > 0 && <div className="menu-sep" />}
        <button type="button" className="menu-item" onClick={() => { setOpen(false); onPickWorkspace(); }}>
          <Icon name="projectOpen" size={15} /><span className="menu-item-body"><span>{labels.openProjectEllipsis}</span></span>
        </button>
      </AnchoredPopover>
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
