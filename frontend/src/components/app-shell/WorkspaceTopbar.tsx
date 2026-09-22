import { ArrowUp, Code2, FileDiff, Menu, PanelRight, Square, Trash2 } from "lucide-react";
import { sessionStatusLabel } from "../../app/presentation-model";
import type { WorkspaceRoute } from "../../app/workspace-route";
import type { AppCopy } from "../../lib/i18n/app-copy";
import type { Session, SessionRuntime } from "../../types";

type Props = {
  route: WorkspaceRoute;
  current?: Session;
  workspace: string;
  runtime: SessionRuntime;
  running: boolean;
  busy: boolean;
  inspectorOpen: boolean;
  labels: AppCopy;
  onOpenSidebar: () => void;
  onBackToWorkspace: () => void;
  onOpenReview: () => void;
  onOpenThread: () => void;
  onCleanupWorktree: () => void;
  onCancelAgent: () => void;
  onStartAgent: () => void;
  onToggleInspector: () => void;
};

function basename(path: string) {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path;
}

export function WorkspaceTopbar({
  route,
  current,
  workspace,
  runtime,
  running,
  busy,
  inspectorOpen,
  labels,
  onOpenSidebar,
  onBackToWorkspace,
  onOpenReview,
  onOpenThread,
  onCleanupWorktree,
  onCancelAgent,
  onStartAgent,
  onToggleInspector,
}: Props) {
  const title =
    route.kind === "providers" ? labels.providerSettings :
    route.kind === "extensions" ? labels.extensions :
    route.kind === "review" ? labels.review :
    current?.goal || (workspace ? basename(workspace) : "LumenCortex");

  const runtimeLabel = runtime.kind === "worktree"
    ? (runtime.branch || labels.worktreeRuntime)
    : labels.localRuntime;

  const subtitle =
    route.kind === "providers"
      ? (workspace ? `${labels.project} · ${basename(workspace)}` : labels.providerConfig)
      : route.kind === "extensions"
        ? (workspace ? `${labels.project} · ${basename(workspace)} · ${runtimeLabel}` : labels.extensions)
        : route.kind === "review"
          ? (current?.goal || labels.review)
          : workspace
            ? `${runtimeLabel}${current?.model ? ` · ${current.model}` : ""}${current ? ` · ${sessionStatusLabel(labels, current.status, running)}` : ""}`
            : labels.runtimeReady;

  const inspectorAvailable = route.kind !== "providers" && route.kind !== "extensions";

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="icon-button sidebar-toggle"
          onClick={onOpenSidebar}
          aria-label={labels.expandSidebar}
        >
          <Menu size={16} strokeWidth={1.7} aria-hidden />
        </button>
        <div className="title-stack">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </div>

      <div className="topbar-actions">
        {(route.kind === "providers" || route.kind === "extensions") && (
          <button className="toolbar-button" onClick={onBackToWorkspace}>
            <Code2 size={14} strokeWidth={1.7} aria-hidden />
            <span>{labels.backToWorkspace}</span>
          </button>
        )}

        {route.kind === "thread" && current && (
          <button className="toolbar-button" onClick={onOpenReview}>
            <FileDiff size={14} strokeWidth={1.7} aria-hidden />
            <span>{labels.review}</span>
          </button>
        )}

        {route.kind === "review" && current && (
          <button className="toolbar-button" onClick={onOpenThread}>
            <Code2 size={14} strokeWidth={1.7} aria-hidden />
            <span>{labels.thread}</span>
          </button>
        )}

        {(route.kind === "thread" || route.kind === "review") &&
          current &&
          runtime.kind === "worktree" &&
          !running && (
            <button className="toolbar-button" onClick={onCleanupWorktree} disabled={busy}>
              <Trash2 size={14} strokeWidth={1.7} aria-hidden />
              <span>{labels.cleanupWorktree}</span>
            </button>
          )}

        {route.kind === "thread" && current && running && (
          <button className="toolbar-button stop" onClick={onCancelAgent} disabled={busy}>
            <Square size={14} strokeWidth={1.9} aria-hidden />
            <span>{labels.stop}</span>
          </button>
        )}

        {route.kind === "thread" &&
          current &&
          !running &&
          (current.status === "created" || current.status === "interrupted") && (
            <button className="toolbar-button" onClick={onStartAgent} disabled={busy}>
              <ArrowUp size={14} strokeWidth={1.7} aria-hidden />
              <span>{current.status === "interrupted" ? labels.resume : labels.start}</span>
            </button>
          )}

        {inspectorAvailable && (
          <button
            className={`icon-button ${inspectorOpen ? "active" : ""}`}
            onClick={onToggleInspector}
            aria-label={labels.inspector}
          >
            <PanelRight size={16} strokeWidth={1.7} aria-hidden />
          </button>
        )}
      </div>
    </header>
  );
}
