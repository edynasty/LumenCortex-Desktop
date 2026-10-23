import type { AppCopy, Locale } from "../../lib/i18n/app-copy";
import { PLUGIN_STATE_LABEL, PLUGIN_STATE_TONE } from "../../lib/plugins";
import { formatRelative } from "../../lib/relative-time";
import { EmptyState } from "../primitives/EmptyState";
import { Icon } from "../primitives/Icon";
import { LoadingState } from "../primitives/LoadingState";
import { usePluginCatalog, type PluginCatalogController } from "../plugins/usePluginCatalog";
import "./plugins.css";

const fill = (template: string, value: string) => template.replace("{value}", value);
const fillCount = (template: string, count: number) => template.replace("{count}", String(count));

// Plugins (ADR-0012): Core's in-process extensions with their enablement, lifecycle state and
// failures. Enablement is global and Core applies it to the open Engine immediately, so a disabled
// import source disappears from the import dialog as soon as this switch flips. The Settings sheet
// renders PluginsList over the app's shared catalog, so the rail's pinned entries follow a toggle.
export function PluginsPane({ labels, locale, onError }: {
  labels: AppCopy;
  locale: Locale;
  onError: (message: string) => void;
}) {
  const controller = usePluginCatalog({ enabled: true, labels, onError });
  return <PluginsList labels={labels} locale={locale} controller={controller} />;
}

export function PluginsList({ labels, locale, controller }: {
  labels: AppCopy;
  locale: Locale;
  controller: PluginCatalogController;
}) {
  const { catalog, state, error, busyId, toggleError, toggle } = controller;

  if (state === "loading" || state === "idle") return <LoadingState label={labels.pluginsLoading} />;
  if (state === "error") {
    return <EmptyState icon={<Icon name="failed" size={18} />} title={labels.pluginsError} body={error} />;
  }
  if (!catalog || catalog.plugins.length === 0) {
    return <EmptyState icon={<Icon name="plugin" size={18} />} title={labels.pluginsEmpty} />;
  }

  return (
    <section className="pane" aria-label={labels.settingsPlugins}>
      <p className="pane-intro">{labels.pluginsLede}</p>
      {toggleError && <p className="plugin-error" role="alert">{toggleError}</p>}
      {catalog.stateError && <p className="plugin-error" role="alert">{catalog.stateError}</p>}
      <ul className="plugin-list">
        {catalog.plugins.map((plugin) => {
          const manifest = plugin.manifest;
          const capabilities = manifest.capabilities.length > 0
            ? manifest.capabilities.join(", ")
            : labels.pluginsNoCapabilities;
          return (
            <li key={manifest.id} className={`plugin-row ${plugin.state === "failed" ? "is-failed" : ""}`}>
              <div className="plugin-head">
                <span className="plugin-title">
                  <strong>{manifest.name}</strong>
                  <span className="mono plugin-id">{manifest.id}</span>
                  {plugin.builtin && <span className="badge">{labels.pluginsBuiltin}</span>}
                  <span className={`badge ${PLUGIN_STATE_TONE[plugin.state]}`}>{labels[PLUGIN_STATE_LABEL[plugin.state]] as string}</span>
                </span>
                <button
                  type="button"
                  className="switch"
                  role="switch"
                  aria-checked={plugin.enabled}
                  aria-label={manifest.name}
                  title={plugin.enabled ? labels.pluginsDisable : labels.pluginsEnable}
                  disabled={busyId === manifest.id}
                  onClick={() => void toggle(plugin)}
                >
                  <span />
                </button>
              </div>
              {manifest.description && <p className="plugin-description">{manifest.description}</p>}
              <dl className="plugin-meta">
                <div>
                  <dt>{labels.pluginsVersion}</dt>
                  <dd className="mono">{manifest.version}</dd>
                </div>
                <div>
                  <dt>{labels.pluginsAPIVersion}</dt>
                  <dd className="mono">{manifest.apiVersion}</dd>
                </div>
                <div>
                  <dt>{labels.pluginsCapabilities}</dt>
                  <dd className="mono">{capabilities}</dd>
                </div>
                {plugin.importSource && (
                  <div>
                    <dt>{labels.pluginsImportSource}</dt>
                    <dd className="mono">{plugin.importSource.id}</dd>
                  </div>
                )}
              </dl>
              {(plugin.error || (plugin.failures ?? 0) > 0) && (
                <div className="plugin-failure">
                  {plugin.error && <p className="plugin-error" role="alert">{plugin.error}</p>}
                  {(plugin.failures ?? 0) > 0 && (
                    <p className="plugin-failure-count">
                      {fillCount(labels.pluginsFailures, plugin.failures ?? 0)}
                      {plugin.lastFailureAt && ` · ${fill(labels.pluginsLastFailure, formatRelative(plugin.lastFailureAt, Date.now(), locale))}`}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {catalog.statePath && (
        <p className="pane-hint">{labels.pluginsStatePath}: <span className="path">{catalog.statePath}</span></p>
      )}
    </section>
  );
}
