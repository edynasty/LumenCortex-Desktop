import { useState, type ReactNode } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { PluginsContent, PluginsSidebar } from "./PluginsPage";
import type { PluginCatalogController } from "./usePluginCatalog";

/** The Plugins page: its sidebar list and the selected plugin's body. The selection lives here so
 *  the two halves stay in step; a plugin that disappears falls back to the first. */
export function usePluginsPage(input: {
  enabled: boolean;
  workspace: string;
  labels: AppCopy;
  controller: PluginCatalogController;
  onOpenImport: (sourceId: string) => void;
  onOpenSettings: () => void;
}): { sidebar?: ReactNode; content?: ReactNode } {
  const { enabled, workspace, labels, controller, onOpenImport, onOpenSettings } = input;
  const [selectedId, setSelectedId] = useState("");
  if (!enabled) return {};
  const plugins = controller.catalog?.plugins ?? [];
  const selected = plugins.find((plugin) => plugin.manifest.id === selectedId) ?? plugins[0];
  return {
    sidebar: (
      <PluginsSidebar
        labels={labels}
        controller={controller}
        selectedId={selected?.manifest.id ?? ""}
        onSelect={setSelectedId}
      />
    ),
    content: (
      <PluginsContent
        labels={labels}
        controller={controller}
        workspace={workspace}
        selected={selected}
        onOpenImport={onOpenImport}
        onOpenSettings={onOpenSettings}
      />
    ),
  };
}
