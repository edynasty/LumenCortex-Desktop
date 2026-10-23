/*
 * Plugin presentation shared by Settings → Plugins, the Plugins page and the rail: the icon name
 * mapping, the lifecycle labels and the entries Desktop derives from a plugin's capabilities.
 * Core exposes capabilities, not UI contributions, so an entry exists only for a capability
 * Desktop knows how to run.
 */
import type { IconName } from "../components/primitives/icons";
import type { PluginInfo, PluginState } from "../types";
import type { AppCopy } from "./i18n/app-copy";

// The semantic names a manifest may carry (manifest.icon). Anything else falls back to the
// generic plugin glyph, so a newer Core never shows a broken or invented icon.
const PLUGIN_ICONS: Record<string, IconName> = {
  import: "import",
};

export function pluginIcon(name?: string): IconName {
  return (name && PLUGIN_ICONS[name]) || "plugin";
}

export const PLUGIN_STATE_LABEL: Record<PluginState, keyof AppCopy> = {
  registered: "pluginsStateRegistered",
  running: "pluginsStateRunning",
  disabled: "pluginsStateDisabled",
  stopped: "pluginsStateStopped",
  failed: "pluginsStateFailed",
};

// The shared badge tones: a failure reads as a problem, a running plugin as healthy.
export const PLUGIN_STATE_TONE: Record<PluginState, string> = {
  registered: "tone-accent",
  running: "tone-ok",
  disabled: "",
  stopped: "",
  failed: "tone-bad",
};

export function pluginStateLabel(plugin: PluginInfo, labels: AppCopy): string {
  return labels[PLUGIN_STATE_LABEL[plugin.state]] as string;
}

/** One entry of a plugin's "功能入口". */
export type PluginEntry = {
  plugin: PluginInfo;
  title: string;
  /** One line under the title on the Plugins page: what running the entry does. */
  hint: string;
  /** The import source the entry opens; empty when Core reports none (the plugin is not running). */
  sourceId: string;
};

/** The entry the rail pins: today only a session-import entry. */
export function primaryEntry(plugin: PluginInfo, labels: AppCopy): PluginEntry | null {
  if (!plugin.manifest.capabilities.includes("session-import")) return null;
  return { plugin, title: labels.pluginEntryImport, hint: labels.pluginEntryImportHint, sourceId: plugin.importSource?.id ?? "" };
}

/** The rail's plugin buttons: enabled, with a primary entry, and not hidden by the user. */
export function railPlugins(plugins: PluginInfo[], hidden: ReadonlySet<string>, labels: AppCopy): PluginEntry[] {
  return plugins
    .filter((plugin) => plugin.enabled && !hidden.has(plugin.manifest.id))
    .map((plugin) => primaryEntry(plugin, labels))
    .filter((entry): entry is PluginEntry => entry !== null);
}
