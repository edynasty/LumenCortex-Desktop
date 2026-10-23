/*
 * The window-level layers over any route: the Settings sheet, the command palette, the OMP import
 * dialog, the worktree cleanup dialog and the error toast. Kept out of WorkspaceView so that file
 * stays a route/props assembly rather than a second render tree.
 */
import type { PaletteAction } from "../components/app-shell/CommandPalette";
import { CommandPalette } from "../components/app-shell/CommandPalette";
import { OmpImportDialog } from "../components/omp/OmpImportDialog";
import type { PluginCatalogController } from "../components/plugins/usePluginCatalog";
import { SettingsSheet, type SettingsPane } from "../components/settings/SettingsSheet";
import type { SidebarGroup } from "../components/sidebar/Sidebar";
import type { WorktreeCleanupTarget } from "../components/worktree/WorktreeCleanupDialog";
import { presentError } from "../lib/error-presentation";
import type { AppCopy, Locale } from "../lib/i18n/app-copy";
import type { ThemePreference } from "../lib/theme";
import type { ConfigState, Health, SessionRuntime } from "../types";
import type { OmpImportSheet } from "./hooks/useWorkspaceController";
import type { SettingsState } from "./useWorkspaceCommands";
import type { WorkspaceRoute } from "./workspace-route";
import { WorkspaceOverlays } from "./WorkspaceOverlays";

type Props = {
  settings: SettingsState;
  paletteOpen: boolean;
  paletteActions: PaletteAction[];
  groups: SidebarGroup[];
  error: string;
  recovery?: { label: string; run: () => void };
  labels: AppCopy;
  locale: Locale;
  themePreference: ThemePreference;
  workspace: string;
  config: ConfigState;
  trusting: boolean;
  health?: Health;
  /** The shared plugin catalog: Settings → Plugins and the rail read the same state. */
  plugins: PluginCatalogController;
  sessionId: string;
  runtime: SessionRuntime;
  ompImport: OmpImportSheet;
  worktreeCleanupTarget: WorktreeCleanupTarget | null;
  onSettingsChange: (settings: SettingsState) => void;
  onCloseSettings: () => void;
  onOpenSettings: (pane: SettingsPane) => void;
  onLocaleChange: (locale: Locale) => void;
  onThemePreferenceChange: (theme: ThemePreference) => void;
  onTrust: () => void;
  onConfigChanged: () => void;
  onError: (message: string) => void;
  onPaletteOpenChange: (open: boolean) => void;
  onSetRoute: (route: WorkspaceRoute) => void;
  onWorktreeCleanupTargetChange: (target: WorktreeCleanupTarget | null) => void;
  onWorktreeCleanupCompleted: (deletedSessionIds: string[]) => void;
  onClearError: () => void;
};

export function WorkspaceLayers(props: Props) {
  const { settings, labels } = props;
  return (
    <>
      {settings.mounted && (
        <SettingsSheet
          open={settings.open}
          pane={settings.pane}
          locale={props.locale}
          labels={labels}
          themePreference={props.themePreference}
          workspace={props.workspace}
          config={props.config}
          trusting={props.trusting}
          health={props.health}
          plugins={props.plugins}
          sessionId={props.sessionId}
          runtime={props.runtime}
          onPaneChange={(pane) => props.onSettingsChange({ ...settings, pane })}
          onClose={props.onCloseSettings}
          onLocaleChange={props.onLocaleChange}
          onThemePreferenceChange={props.onThemePreferenceChange}
          onTrust={props.onTrust}
          onConfigChanged={props.onConfigChanged}
          onError={props.onError}
        />
      )}
      {props.paletteOpen && (
        <CommandPalette
          labels={labels}
          groups={props.groups}
          actions={props.paletteActions}
          onOpenThread={(sessionId) => props.onSetRoute({ kind: "thread", sessionId })}
          onClose={() => props.onPaletteOpenChange(false)}
        />
      )}
      <WorkspaceOverlays
        worktreeCleanupTarget={props.worktreeCleanupTarget}
        error={presentError(labels, props.error)}
        labels={labels}
        onWorktreeCleanupClose={() => props.onWorktreeCleanupTargetChange(null)}
        onWorktreeCleanupCompleted={props.onWorktreeCleanupCompleted}
        errorActionLabel={props.recovery?.label}
        onErrorAction={props.recovery?.run}
        onClearError={props.onClearError}
      />
      <OmpImportDialog
        open={props.ompImport.open}
        labels={labels}
        locale={props.locale}
        initialSourceId={props.ompImport.sourceId}
        onClose={() => props.ompImport.setOpen(false)}
        onImported={props.ompImport.openSession}
        onOpenPlugins={() => { props.ompImport.setOpen(false); props.onOpenSettings("plugins"); }}
      />
    </>
  );
}
