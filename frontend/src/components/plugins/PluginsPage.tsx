/*
 * Plugins page (ADR-0012): the rail's plugin surface. The sidebar lists Core's plugins; the body
 * shows the selected one — what it is, its enablement, the entries Desktop derives from its
 * capabilities, and whether it rides in the rail. Diagnostics stay in Settings → Plugins.
 */
import { useId } from "react";
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
  const entryHintId = useId();
  if (!workspace) return <p className="pane-intro">{labels.settingsNoProject}</p>;
  if (controller.state === "loading" || controller.state === "idle") return <LoadingState label={labels.pluginsLoading} />;
  if (controller.state === "error") {
    return <EmptyState icon={<Icon name="failed" size={18} />} title={labels.pluginsError} body={controller.error} />;
  }
  if (!selected) return <EmptyState icon={<Icon name="plugin" size={18} />} title={labels.pluginsEmpty} />;

  const manifest = selected.manifest;
  const entry = primaryEntry(selected, labels);
  const shown = !hidden.has(manifest.id);

  return (
    <div className="plugin-page-scroll">
      <section className="plugin-page" aria-label={manifest.name}>
        <header className="plugin-hero">
          <span className="plugin-hero-icon"><Icon name={pluginIcon(manifest.icon)} size={24} /></span>
          <div className="plugin-hero-text">
            <div className="plugin-hero-title">
              <h2>{manifest.name}</h2>
              <span className={`badge ${PLUGIN_STATE_TONE[selected.state]}`}>
                {labels[PLUGIN_STATE_LABEL[selected.state]] as string}
              </span>
            </div>
            <span className="mono plugin-id">{manifest.id} · v{manifest.version}</span>
            {manifest.description && <p className="plugin-hero-desc">{manifest.description}</p>}
          </div>
          <label className="plugin-hero-toggle">
            <span>{selected.enabled ? labels.pluginEnabled : labels.pluginDisabledState}</span>
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
          </label>
        </header>

        {controller.toggleError && <p className="plugin-error" role="alert">{controller.toggleError}</p>}
        {controller.catalog?.stateError && <p className="plugin-error" role="alert">{controller.catalog.stateError}</p>}
        {selected.error && <p className="plugin-error" role="alert">{selected.error}</p>}

        <section className="plugin-card" aria-labelledby="plugin-entries-title">
          <h3 id="plugin-entries-title" className="plugin-card-title">{labels.pluginEntries}</h3>
          {entry ? (
            <>
              <button
                type="button"
                className="plugin-entry"
                aria-label={entry.title}
                aria-describedby={entryHintId}
                disabled={!selected.enabled}
                onClick={() => onOpenImport(entry.sourceId)}
              >
                <span className="plugin-entry-icon"><Icon name={pluginIcon(manifest.icon)} size={16} /></span>
                <span className="plugin-entry-text">
                  <span className="plugin-entry-title">{entry.title}</span>
                  <span id={entryHintId} className="plugin-entry-hint">{selected.enabled ? entry.hint : labels.pluginEntryDisabled}</span>
                </span>
                <Icon name="expand" size={14} className="plugin-entry-chevron" />
              </button>
              <div className="plugin-setting">
                <span className="plugin-setting-text">
                  <span>{labels.pluginRailShow}</span>
                  <span className="plugin-setting-hint">{labels.pluginRailShowHint}</span>
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
            </>
          ) : (
            <p className="plugin-setting-hint">{labels.pluginNoEntries}</p>
          )}
        </section>

        <section className="plugin-card" aria-labelledby="plugin-details-title">
          <h3 id="plugin-details-title" className="plugin-card-title">{labels.pluginDetails}</h3>
          <dl className="plugin-details">
            <dt>{labels.pluginsVersion}</dt><dd className="mono">{manifest.version}</dd>
            <dt>{labels.pluginsAPIVersion}</dt><dd className="mono">{manifest.apiVersion}</dd>
            <dt>{labels.pluginsCapabilities}</dt>
            <dd>
              {manifest.capabilities.length > 0
                ? manifest.capabilities.map((capability) => <span key={capability} className="plugin-chip mono">{capability}</span>)
                : labels.pluginsNoCapabilities}
            </dd>
            {selected.importSource && (
              <>
                <dt>{labels.pluginsImportSource}</dt>
                <dd className="mono">{selected.importSource.id}</dd>
              </>
            )}
          </dl>
        </section>

        <button type="button" className="plugin-settings-link" onClick={onOpenSettings}>
          <Icon name="settings" size={13} />
          <span>{labels.pluginSettingsLink}</span>
          <Icon name="expand" size={12} />
        </button>
      </section>
    </div>
  );
}
