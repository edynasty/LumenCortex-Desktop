/*
 * Global rail: the top-level pages, the plugins that ride along, Settings and the build version.
 * It never collapses on a docked window, so navigation stays in one place while the contextual
 * sidebar next to it opens, closes and resizes.
 */
import type { WorkspacePage } from "../../app/workspace-route";
import { shortCommit, useBuildInfo, versionLabel } from "../../lib/build-info";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { pluginIcon, railPlugins } from "../../lib/plugins";
import { useHiddenPluginIds } from "../../lib/rail-plugins";
import type { PluginInfo } from "../../types";
import { Icon } from "../primitives/Icon";
import type { IconName } from "../primitives/icons";

type Props = {
  page: WorkspacePage;
  settingsOpen: boolean;
  /** Threads that need the user (gate, failure, interruption). Shown as a count. */
  attention: number;
  /** Worktree sessions on this project. Shown as a quiet dot. */
  worktrees: number;
  /** Core's plugins; the enabled ones with a primary entry get a button below the pages. */
  plugins: PluginInfo[];
  labels: AppCopy;
  onNavigate: (page: WorkspacePage) => void;
  onOpenSettings: () => void;
  /** Opens Settings → About, where the full build identity is listed. */
  onOpenAbout: () => void;
  onOpenImport: (sourceId: string) => void;
};

export function Rail({ page, settingsOpen, attention, worktrees, plugins, labels, onNavigate, onOpenSettings, onOpenAbout, onOpenImport }: Props) {
  const build = useBuildInfo();
  const pinned = railPlugins(plugins, useHiddenPluginIds(), labels);
  const items: { page: WorkspacePage; icon: IconName; label: string; hint: string; count?: number; dot?: boolean }[] = [
    { page: "threads", icon: "discussion", label: labels.threadsPage, hint: `${labels.threadsPage} ⌘1`, count: attention },
    { page: "context", icon: "context", label: labels.contextPage, hint: `${labels.contextPage} ⌘2` },
    { page: "scm", icon: "worktree", label: labels.sourceControl, hint: `${labels.sourceControl} ⌘3`, dot: worktrees > 0 },
    { page: "agents", icon: "agents", label: labels.agentsPage, hint: `${labels.agentsPage} ⌘4` },
    { page: "plugins", icon: "plugin", label: labels.pluginsPage, hint: `${labels.pluginsPage} ⌘5` },
  ];
  return (
    <nav className="rail" aria-label={labels.mainNav}>
      <div className="rail-top">
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
        {pinned.length > 0 && (
          <div className="rail-plugins" role="group" aria-label={labels.pluginRail}>
            {pinned.map((entry) => (
              <button
                key={entry.plugin.manifest.id}
                type="button"
                className="rail-btn"
                aria-label={entry.title}
                title={`${entry.title} · ${entry.plugin.manifest.name}`}
                onClick={() => onOpenImport(entry.sourceId)}
              >
                <Icon name={pluginIcon(entry.plugin.manifest.icon)} size={19} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="rail-bottom">
        {build && (
          <button
            type="button"
            className="rail-version"
            aria-label={`${labels.aboutVersion} ${versionLabel(build)}`}
            title={`${build.app} ${versionLabel(build)} · ${shortCommit(build.commit)}`}
            onClick={onOpenAbout}
          >
            {versionLabel(build)}
          </button>
        )}
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
