/*
 * Plugins page (ADR-0012): the rail's plugin surface. The sidebar lists Core's plugins; the body
 * shows the selected one — what it is, its enablement, the entries Desktop derives from its
 * capabilities, and whether it rides in the rail. Diagnostics stay in Settings → Plugins.
 */
import type { AppCopy } from "../../lib/i18n/app-copy";
import {
  PLUGIN_STATE_LABEL,
  PLUGIN_STATE_TONE,
  pluginIcon,
  pluginStateLabel,
  primaryEntry,
} from "../../lib/plugins";
import { setPluginRailVisible, useHiddenPluginIds } from "../../lib/rail-plugins";
import type { PluginInfo } from "../../types";
import { EmptyState } from "../primitives/EmptyState";
import { Icon } from "../primitives/Icon";
import { LoadingState } from "../primitives/LoadingState";
import "../settings/plugins.css";
import "./plugins-page.css";
import type { PluginCatalogController } from "./usePluginCatalog";

export function PluginsSidebar({ labels, controller, selectedId, onSelect }: {
  labels: AppCopy;
  controller: PluginCatalogController;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const plugins = controller.catalog?.plugins ?? [];
  if (controller.state === "loading" || controller.state === "idle") {
    return <p className="sidebar-empty">{labels.pluginsLoading}</p>;
  }
  if (controller.state === "error") return <p className="sidebar-empty">{labels.pluginsError}</p>;
  if (plugins.length === 0) return <p className="sidebar-empty">{labels.pluginsEmpty}</p>;

  return (
    <nav className="sidebar-scroll plugin-nav" aria-label={labels.pluginsPage}>
      {plugins.map((plugin) => {
        const active = plugin.manifest.id === selectedId;
        return (
          <button
            key={plugin.manifest.id}
            type="button"
            className={`list-row plugin-nav-row ${active ? "is-selected" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={() => onSelect(plugin.manifest.id)}
          >
            <Icon name={pluginIcon(plugin.manifest.icon)} size={15} />
            <span className="list-row-main">{plugin.manifest.name}</span>
            <span className={`plugin-state-dot is-${plugin.state}`} aria-hidden />
            <span className="sr-only">{pluginStateLabel(plugin, labels)}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function PluginsContent({ labels, controller, workspace, selected, onOpenImport, onOpenSettings }: {
  labels: AppCopy;
  controller: PluginCatalogController;
  workspace: string;
  selected?: PluginInfo;
  onOpenImport: (sourceId: string) => void;
  onOpenSettings: () => void;
}) {
  const hidden = useHiddenPluginIds();
  if (!workspace) return <p className="pane-intro">{labels.settingsNoProject}</p>;
  if (controller.state === "loading" || controller.state === "idle") return <LoadingState label={labels.pluginsLoading} />;
  if (controller.state === "error") {
    return <EmptyState icon={<Icon name="failed" size={18} />} title={labels.pluginsError} body={controller.error} />;
  }
  if (!selected) return <EmptyState icon={<Icon name="plugin" size={18} />} title={labels.pluginsEmpty} />;

  const manifest = selected.manifest;
  const entry = primaryEntry(selected, labels);
  const shown = !hidden.has(manifest.id);
  const capabilities = manifest.capabilities.length > 0
    ? manifest.capabilities.join(", ")
    : labels.pluginsNoCapabilities;

  return (
    <section className="pane plugin-page" aria-label={manifest.name}>
      <section className="plugin-hero">
        <span className="plugin-hero-icon"><Icon name={pluginIcon(manifest.icon)} size={20} /></span>
        <div className="plugin-hero-text">
          <h3>{manifest.name}</h3>
          <span className="mono plugin-id">{manifest.id}</span>
        </div>
        <span className={`badge ${PLUGIN_STATE_TONE[selected.state]}`}>
          {labels[PLUGIN_STATE_LABEL[selected.state]] as string}
        </span>
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={selected.enabled}
          aria-label={manifest.name}
          title={selected.enabled ? labels.pluginsDisable : labels.pluginsEnable}
          disabled={controller.busyId === manifest.id}
          onClick={() => void controller.toggle(selected)}
        >
          <span />
        </button>
      </section>

      {manifest.description && <p className="pane-intro">{manifest.description}</p>}
      {controller.toggleError && <p className="plugin-error" role="alert">{controller.toggleError}</p>}
      {controller.catalog?.stateError && <p className="plugin-error" role="alert">{controller.catalog.stateError}</p>}
      {selected.error && <p className="plugin-error" role="alert">{selected.error}</p>}

      <dl className="plugin-meta">
        <div><dt>{labels.pluginsVersion}</dt><dd className="mono">{manifest.version}</dd></div>
        <div><dt>{labels.pluginsAPIVersion}</dt><dd className="mono">{manifest.apiVersion}</dd></div>
        <div><dt>{labels.pluginsCapabilities}</dt><dd className="mono">{capabilities}</dd></div>
        {selected.importSource && (
          <div><dt>{labels.pluginsImportSource}</dt><dd className="mono">{selected.importSource.id}</dd></div>
        )}
      </dl>

      <section className="pane-section">
        <h4>{labels.pluginEntries}</h4>
        {entry ? (
          <>
            <button
              type="button"
              className="plugin-entry"
              disabled={!selected.enabled}
              onClick={() => onOpenImport(entry.sourceId)}
            >
              <Icon name={pluginIcon(manifest.icon)} size={15} />
              <span>{entry.title}</span>
            </button>
            {!selected.enabled && <p className="pane-hint">{labels.pluginEntryDisabled}</p>}
          </>
        ) : (
          <p className="pane-hint">{labels.pluginNoEntries}</p>
        )}
      </section>

      {entry && (
        <section className="pane-section">
          <div className="setting-row">
            <span className="setting-list-main">
              <span>{labels.pluginRailShow}</span>
              <span className="pane-hint">{labels.pluginRailShowHint}</span>
            </span>
            <button
              type="button"
              className="switch"
              role="switch"
              aria-checked={shown}
              aria-label={labels.pluginRailShow}
              disabled={!selected.enabled}
              onClick={() => setPluginRailVisible(manifest.id, !shown)}
            >
              <span />
            </button>
          </div>
        </section>
      )}

      <p className="pane-hint">
        <button type="button" className="link-btn" onClick={onOpenSettings}>{labels.pluginSettingsLink}</button>
      </p>
    </section>
  );
}
