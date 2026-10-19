import { createElement, useEffect, useRef } from "react";
import type { PaletteAction } from "../components/app-shell/CommandPalette";
import { Icon } from "../components/primitives/Icon";
import type { IconName } from "../components/primitives/icons";
import type { SettingsPane } from "../components/settings/SettingsSheet";
import type { AppCopy, Locale } from "../lib/i18n/app-copy";
import type { ThemePreference } from "../lib/theme";
import type { Session } from "../types";
import type { InspectorTab } from "../components/inspector/inspector-types";
import { errorRecoveryKind } from "./error-recovery";
import type { WorkspacePage, WorkspaceRoute } from "./workspace-route";

/** Settings sheet state: `mounted` stays true after the first open so unsaved edits survive. */
export type SettingsState = { open: boolean; pane: SettingsPane; mounted: boolean };

type Input = {
  route: WorkspaceRoute;
  current?: Session;
  selectedSessionId: string;
  /** Ids of the loaded sessions: a deleted thread is not reopened. */
  sessionIds: ReadonlySet<string>;
  workspace: string;
  locale: Locale;
  labels: AppCopy;
  settings: SettingsState;
  paletteOpen: boolean;
  onSetRoute: (route: WorkspaceRoute) => void;
  onSettingsChange: (settings: SettingsState) => void;
  onPaletteOpenChange: (open: boolean) => void;
  onNewTask: () => void;
  onPickWorkspace: () => void;
  onLocaleChange: (locale: Locale) => void;
  onThemePreferenceChange: (theme: ThemePreference) => void;
  error: string;
  onClearError: () => void;
  onOpenWorkspace: (path: string) => void;
  onInspectorTabChange: (tab: InspectorTab) => void;
  onInspectorOpenChange: (open: boolean) => void;
};

/**
 * Page navigation, the Settings sheet, the command palette's actions and the app shortcuts
 * (⌘K palette, ⌘, settings, ⌘N new thread, ⌘1–3 pages) and the error toast's recovery action.
 * ⌘B / ⌘I belong to the window shell.
 */
export function useWorkspaceCommands(input: Input) {
  const { route, current, workspace, labels, settings } = input;

  const openSettings = (pane: SettingsPane) => {
    input.onPaletteOpenChange(false);
    input.onSettingsChange({ open: true, pane, mounted: true });
  };
  const closeSettings = () => input.onSettingsChange({ ...settings, open: false });

  // Each rail page reopens what it last showed: the Threads page its thread, Source Control its checkout.
  const lastThread = useRef("");
  if (input.selectedSessionId) lastThread.current = input.selectedSessionId;
  if (lastThread.current && !input.sessionIds.has(lastThread.current)) lastThread.current = "";
  const lastCheckout = useRef<"main" | string>("main");
  if (route.kind === "scm") lastCheckout.current = route.checkout;
  if (lastCheckout.current !== "main" && !input.sessionIds.has(lastCheckout.current)) lastCheckout.current = "main";

  const navigate = (page: WorkspacePage) => {
    if (settings.open) closeSettings();
    if (page === "threads") {
      input.onSetRoute(lastThread.current ? { kind: "thread", sessionId: lastThread.current } : { kind: "new-task" });
    } else if (page === "scm") {
      input.onSetRoute({ kind: "scm", checkout: lastCheckout.current });
    } else if (page === "agents") {
      input.onSetRoute({ kind: "agents" });
    } else {
      input.onSetRoute({ kind: "context" });
    }
  };

  const darkNow = typeof document !== "undefined" && document.documentElement.dataset.theme === "dark";
  const action = (id: string, icon: IconName, label: string, run: () => void, keys?: string): PaletteAction => ({
    id,
    icon: createElement(Icon, { name: icon, size: 15 }),
    label,
    keys,
    run,
  });
  const paletteActions: PaletteAction[] = [
    ...(workspace ? [action("new", "newThread", labels.newTask, input.onNewTask, "⌘N")] : []),
    action("open-project", "projectOpen", labels.openProjectEllipsis, input.onPickWorkspace),
    ...(workspace ? [
      action("page-threads", "discussion", labels.threadsPage, () => navigate("threads"), "⌘1"),
      action("page-context", "context", labels.contextPage, () => navigate("context"), "⌘2"),
      action("page-scm", "worktree", labels.sourceControl, () => navigate("scm"), "⌘3"),
      action("page-agents", "agents", labels.agentsPage, () => navigate("agents"), "⌘4"),
    ] : []),
    ...(current && route.kind === "thread"
      ? [action("changes", "changes", labels.changesView, () => input.onSetRoute({ kind: "review", sessionId: current.id }))]
      : []),
    action("settings", "settings", labels.settings, () => openSettings("general"), "⌘,"),
    action("models", "model", labels.settingsModels, () => openSettings("models")),
    action("theme", darkNow ? "light" : "dark", labels.paletteToggleTheme, () => input.onThemePreferenceChange(darkNow ? "light" : "dark")),
    action("language", "language", labels.paletteSwitchLanguage, () => input.onLocaleChange(input.locale === "zh-CN" ? "en" : "zh-CN")),
  ];

  // The error toast's recovery action: where the user fixes what the error names.
  const recoveryKind = errorRecoveryKind(input.error);
  const recovery = recoveryKind ? {
    label: recoveryKind === "provider" ? labels.providerConfig
      : recoveryKind === "permissions" ? labels.permissions
        : workspace ? labels.reopenProject : labels.openProject,
    run: () => {
      input.onClearError();
      if (recoveryKind === "provider") {
        openSettings("models");
      } else if (recoveryKind === "permissions") {
        if (route.kind !== "new-task" && route.kind !== "thread") {
          input.onSetRoute(current ? { kind: "thread", sessionId: current.id } : { kind: "new-task" });
        }
        input.onInspectorTabChange("run");
        input.onInspectorOpenChange(true);
      } else if (workspace) {
        input.onOpenWorkspace(workspace);
      } else {
        input.onPickWorkspace();
      }
    },
  } : undefined;

  // A ref keeps the listener stable while it always sees the latest state.
  const latest = useRef({ input, navigate, openSettings });
  latest.current = { input, navigate, openSettings };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const { input: now, navigate: go, openSettings: settingsAt } = latest.current;
      const key = event.key.toLowerCase();
      const hasProject = Boolean(now.workspace);
      let handled = true;
      if (key === "k") now.onPaletteOpenChange(!now.paletteOpen);
      else if (key === ",") settingsAt("general");
      else if (key === "n" && hasProject) now.onNewTask();
      else if (key === "1" && hasProject) go("threads");
      else if (key === "2" && hasProject) go("context");
      else if (key === "3" && hasProject) go("scm");
      else if (key === "4" && hasProject) go("agents");
      else handled = false;
      if (handled) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return { navigate, openSettings, closeSettings, paletteActions, recovery };
}
