/* No project open: the A1 identity, Open project, and the recent projects Desktop remembers.
   A recent entry whose folder is gone is greyed and inert; any entry can be removed (×). */
import type { AppCopy } from "../../lib/i18n/app-copy";
import { AppIcon } from "../brand/A1Mark";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";

type Props = {
  labels: AppCopy;
  recentProjects: string[];
  missingProjects: string[];
  onRemoveRecentProject: (path: string) => void;
  busy: boolean;
  online: boolean;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
};

function basename(path: string) {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
}

export function Welcome({ labels, recentProjects, missingProjects, onRemoveRecentProject, busy, online, onPickWorkspace, onOpenWorkspace }: Props) {
  return (
    <div className="welcome">
      <div className="welcome-card">
        <AppIcon size={88} />
        <h1>LumenCortex</h1>
        <p>{labels.welcomeBody}</p>
        <Button variant="primary" icon={<Icon name="projectOpen" size={15} />} disabled={busy} onClick={onPickWorkspace}>
          {labels.openProjectEllipsis}
        </Button>
        {recentProjects.length > 0 && (
          <div className="welcome-recent">
            <div className="menu-label">{labels.recentProjects}</div>
            {recentProjects.slice(0, 8).map((path) => {
              const gone = missingProjects.includes(path);
              return (
                <div key={path} className={`welcome-project-row${gone ? " is-missing" : ""}`}>
                  <button
                    type="button"
                    className="welcome-project"
                    disabled={busy || gone}
                    title={gone ? `${labels.projectMissing}: ${path}` : path}
                    onClick={() => onOpenWorkspace(path)}
                  >
                    <Icon name="project" size={15} />
                    <span>{basename(path)}</span>
                    <span className="mono muted">{gone ? `${labels.projectMissing} · ${path}` : path}</span>
                  </button>
                  <button
                    type="button"
                    className="welcome-project-remove"
                    title={labels.removeRecentProject}
                    aria-label={`${labels.removeRecentProject}: ${basename(path)}`}
                    onClick={() => onRemoveRecentProject(path)}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <p className="welcome-foot">
          <span className={`core-dot ${online ? "" : "is-ready"}`} aria-hidden />
          {labels.welcomeCore}
        </p>
      </div>
    </div>
  );
}
