import { useCallback, useEffect, useState } from "react";
import { bridge } from "../../lib/bridge";
import type { AppCopy, Locale } from "../../lib/i18n/app-copy";
import { formatRelative } from "../../lib/relative-time";
import type { PluginCatalog, PluginInfo, PluginState } from "../../types";
import { EmptyState } from "../primitives/EmptyState";
import { Icon } from "../primitives/Icon";
import { LoadingState } from "../primitives/LoadingState";
import "./plugins.css";

const fill = (template: string, value: string) => template.replace("{value}", value);
const fillCount = (template: string, count: number) => template.replace("{count}", String(count));

const STATE_LABEL: Record<PluginState, keyof AppCopy> = {
  registered: "pluginsStateRegistered",
  running: "pluginsStateRunning",
  disabled: "pluginsStateDisabled",
  stopped: "pluginsStateStopped",
  failed: "pluginsStateFailed",
};

// The shared badge tones: a failure reads as a problem, a running plugin as healthy.
const STATE_TONE: Record<PluginState, string> = {
  registered: "tone-accent",
  running: "tone-ok",
  disabled: "",
  stopped: "",
  failed: "tone-bad",
};

type LoadState = "loading" | "ready" | "error";

// Plugins (ADR-0012): Core's in-process extensions with their enablement, lifecycle state and
// failures. Enablement is global and Core applies it to the open Engine immediately, so a disabled
// import source disappears from the import dialog as soon as this switch flips.
export function PluginsPane({ labels, locale, onError }: {
  labels: AppCopy;
  locale: Locale;
  onError: (message: string) => void;
}) {
  const [catalog, setCatalog] = useState<PluginCatalog | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [toggleError, setToggleError] = useState("");

  const load = useCallback(async () => {
    try {
      setCatalog(await bridge.plugins());
      setState("ready");
      setError("");
    } catch (err) {
      setCatalog(null);
      setState("error");
      setError(String(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // The switch writes first and re-reads: Core may refuse the change, and its state is the truth.
  const toggle = useCallback(async (plugin: PluginInfo) => {
    setBusyId(plugin.manifest.id);
    setToggleError("");
    try {
      await bridge.setPluginEnabled(plugin.manifest.id, !plugin.enabled);
      await load();
    } catch (err) {
      setToggleError(`${labels.pluginsToggleError}: ${String(err)}`);
      onError(String(err));
    } finally {
      setBusyId("");
    }
  }, [labels.pluginsToggleError, load, onError]);

  if (state === "loading") return <LoadingState label={labels.pluginsLoading} />;
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
                  <span className={`badge ${STATE_TONE[plugin.state]}`}>{labels[STATE_LABEL[plugin.state]] as string}</span>
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
