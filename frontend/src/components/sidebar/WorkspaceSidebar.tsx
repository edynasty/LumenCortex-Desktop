import type { AppCopy } from "../../lib/i18n/app-copy";
import type { ThemePreference } from "../../lib/theme";
import { Sidebar, type SidebarGroup } from "./Sidebar";

type RuntimeState = "ready" | "online" | "offline";

type Props = {
  open: boolean;
  workspace: string;
  groups: SidebarGroup[];
  recentProjects: string[];
  selectedSessionId: string;
  providerActive: boolean;
  extensionsActive: boolean;
  runtimeState: RuntimeState;
  runtimeVersion?: string;
  labels: AppCopy;
  themePreference: ThemePreference;
  onClose: () => void;
  onNewTask: () => void;
  onPickWorkspace: () => void;
  onOpenWorkspace: (path: string) => void;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onPinSession: (sessionId: string, pinned: boolean) => void;
  onArchiveSession: (sessionId: string, archived: boolean) => void;
  onOpenProviders: () => void;
  onOpenExtensions: () => void;
  onSwitchLocale: () => void;
  onThemePreferenceChange: (theme: ThemePreference) => void;
};

function basename(path: string) {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
}

export function WorkspaceSidebar({
  open,
  workspace,
  groups,
  recentProjects,
  selectedSessionId,
  providerActive,
  extensionsActive,
  runtimeState,
  runtimeVersion,
  labels,
  themePreference,
  onClose,
  onNewTask,
  onPickWorkspace,
  onOpenWorkspace,
  onSelectSession,
  onRenameSession,
  onPinSession,
  onArchiveSession,
  onOpenProviders,
  onOpenExtensions,
  onSwitchLocale,
  onThemePreferenceChange,
}: Props) {
  return (
    <Sidebar
      open={open}
      workspace={workspace}
      workspaceName={workspace ? basename(workspace) : ""}
      groups={groups}
      recentProjects={recentProjects}
      selectedSessionId={selectedSessionId}
      providerActive={providerActive}
      extensionsActive={extensionsActive}
      runtimeState={runtimeState}
      runtimeVersion={runtimeVersion}
      labels={{
        close: labels.close,
        newTask: labels.newTask,
        project: labels.project,
        openProject: labels.openProject,
        sessions: labels.sessions,
        noSessions: labels.noSessions,
        threadSearch: labels.threadSearch,
        recentProjects: labels.recentProjects,
        providerSettings: labels.providerSettings,
        extensions: labels.extensions,
        language: labels.language,
        theme: labels.theme,
        themeSystem: labels.themeSystem,
        themeLight: labels.themeLight,
        themeDark: labels.themeDark,
        runtimeReady: labels.runtimeReady,
        runtimeOnline: labels.runtimeOnline,
        runtimeOffline: labels.runtimeOffline,
        renameThread: labels.renameThread,
        pinThread: labels.pinThread,
        unpinThread: labels.unpinThread,
        archiveThread: labels.archiveThread,
        restoreThread: labels.restoreThread,
        save: labels.save,
        cancel: labels.cancel,
        threadMenu: labels.threadMenu,
        localRuntime: labels.localRuntime,
        worktreeRuntime: labels.worktreeRuntime,
      }}
      onClose={onClose}
      onNewTask={onNewTask}
      onPickWorkspace={onPickWorkspace}
      onOpenWorkspace={onOpenWorkspace}
      onSelectSession={onSelectSession}
      onRenameSession={onRenameSession}
      onPinSession={onPinSession}
      onArchiveSession={onArchiveSession}
      onOpenProviders={onOpenProviders}
      onOpenExtensions={onOpenExtensions}
      themePreference={themePreference}
      onSwitchLocale={onSwitchLocale}
      onThemePreferenceChange={onThemePreferenceChange}
    />
  );
}
