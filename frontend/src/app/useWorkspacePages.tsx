import type { ReactNode } from "react";
import { useContextPage } from "../components/context/useContextPage";
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
  onSetRoute: (route: WorkspaceRoute) => void;
  onError: (message: string) => void;
  onWorktreeCleanupTargetChange: (target: WorktreeCleanupTarget | null) => void;
  onSidebarDrawerOpenChange: (open: boolean) => void;
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

  if (route.kind === "context") return context;
  if (route.kind === "scm") return sourceControl;
  return {};
}
