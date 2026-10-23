import type { ReactNode } from "react";
import { useContextPage } from "../components/context/useContextPage";
import type { PluginCatalogController } from "../components/plugins/usePluginCatalog";
import { usePluginsPage } from "../components/plugins/usePluginsPage";
import { useSourceControlPage } from "../components/scm/useSourceControlPage";
import type { WorktreeCleanupTarget } from "../components/worktree/WorktreeCleanupDialog";
import type { AppCopy, Locale } from "../lib/i18n/app-copy";
import type { Session } from "../types";
import type { WorkspaceRoute } from "./workspace-route";

type Input = {
  route: WorkspaceRoute;
  workspace: string;
  sessions: Session[];
  labels: AppCopy;
  locale: Locale;
  /** Core's plugin catalog, shared with the rail so enablement and pinning stay in step. */
  plugins: PluginCatalogController;
  onSetRoute: (route: WorkspaceRoute) => void;
  onError: (message: string) => void;
  onWorktreeCleanupTargetChange: (target: WorktreeCleanupTarget | null) => void;
  onSidebarDrawerOpenChange: (open: boolean) => void;
  /** Opens the import dialog on one plugin's source. */
  onOpenImport: (sourceId: string) => void;
  /** Settings → Plugins, where a plugin's failures and state file are reported. */
  onOpenPluginSettings: () => void;
};

/**
 * The rail's non-thread pages. Each page hook stays mounted (and idle while its page is hidden)
 * so its selection survives page switches; only the current page's sidebar and body are shown.
 */
export function useWorkspacePages(input: Input): { sidebar?: ReactNode; content?: ReactNode } {
  const { route, workspace, sessions, labels, locale, onError } = input;
  const openThread = (sessionId: string) => input.onSetRoute({ kind: "thread", sessionId });

  const context = useContextPage({
    enabled: route.kind === "context",
    workspace,
    sessions,
    labels,
    locale,
    onOpenThread: openThread,
    onError,
  });

  const sourceControl = useSourceControlPage({
    enabled: route.kind === "scm",
    workspace,
    sessions,
    checkout: route.kind === "scm" ? route.checkout : "main",
    labels,
    locale,
    // Picking a checkout navigates, like picking a thread: the compact drawer gets out of the way.
    onSelectCheckout: (checkout) => {
      input.onSidebarDrawerOpenChange(false);
      input.onSetRoute({ kind: "scm", checkout });
    },
    onOpenThread: openThread,
    onCleanupWorktree: input.onWorktreeCleanupTargetChange,
  });

  const plugins = usePluginsPage({
    enabled: route.kind === "plugins",
    workspace,
    labels,
    controller: input.plugins,
    onOpenImport: input.onOpenImport,
    onOpenSettings: input.onOpenPluginSettings,
  });

  if (route.kind === "context") return context;
  if (route.kind === "scm") return sourceControl;
  if (route.kind === "plugins") return plugins;
  return {};
}
