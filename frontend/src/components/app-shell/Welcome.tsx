/* No project open: the A1 identity, Open project, and the recent projects Core remembers. */
import type { AppCopy } from "../../lib/i18n/app-copy";
import { AppIcon } from "../brand/A1Mark";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";

type Props = {
  labels: AppCopy;
  recentProjects: string[];
  busy: boolean;
  online: boolean;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
};

function basename(path: string) {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
}

export function Welcome({ labels, recentProjects, busy, online, onPickWorkspace, onOpenWorkspace }: Props) {
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
            {recentProjects.slice(0, 8).map((path) => (
              <button key={path} type="button" className="welcome-project" disabled={busy} title={path} onClick={() => onOpenWorkspace(path)}>
                <Icon name="project" size={15} />
                <span>{basename(path)}</span>
                <span className="mono muted">{path}</span>
              </button>
            ))}
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
