/* Title and page actions in the toolbar's main segment (right of the rail + sidebar lead). */
import { useState } from "react";
import type { WorkspaceRoute } from "../../app/workspace-route";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { sessionUI } from "../../lib/session-ui";
import type { Session, SessionRuntime } from "../../types";
import { AnchoredPopover } from "../primitives/AnchoredPopover";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { IconButton } from "../primitives/IconButton";
import { SegmentedControl } from "../primitives/SegmentedControl";
import type { ShellSize } from "./AppShell";

type Props = {
  route: WorkspaceRoute;
  size: ShellSize;
  current?: Session;
  parent?: Session;
  runtime: SessionRuntime;
  running: boolean;
  busy: boolean;
  inspectorAvailable: boolean;
  inspectorOpen: boolean;
  labels: AppCopy;
  onSetRoute: (route: WorkspaceRoute) => void;
  onCleanupWorktree: () => void;
  onCancelAgent: () => void;
  onStartAgent: () => void;
  onOpenPalette: () => void;
  onToggleInspector: () => void;
};

function WorktreePill({ runtime, running, busy, labels, onOpenScm, onCleanup }: {
  runtime: SessionRuntime;
  running: boolean;
  busy: boolean;
  labels: AppCopy;
  onOpenScm: () => void;
  onCleanup: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (runtime.kind !== "worktree") {
    return (
      <span className="wt-pill is-static" title={runtime.path}>
        <Icon name="local" size={13} />
        <span className="wt-branch">{labels.localRuntime}</span>
      </span>
    );
  }
  return (
    <div className="wt-pill-wrap is-chip popover-anchor no-drag">
      <button type="button" className="wt-pill" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)} title={runtime.path}>
        <Icon name="worktree" size={13} />
        <span className="wt-branch">{runtime.branch || labels.worktreeRuntime}</span>
      </button>
      <AnchoredPopover open={open} onClose={() => setOpen(false)} label={labels.worktreeRuntime} className="wt-pop">
        <div className="wt-pop-head">
          <Icon name="worktree" size={16} />
          <div>
            <strong>{runtime.branch || labels.worktreeRuntime}</strong>
            <span>{runtime.base ? `${labels.worktreeBase} ${runtime.base} · ` : ""}{runtime.path}</span>
          </div>
        </div>
        <p className="wt-pop-note">{labels.worktreeRuntimeDescription}</p>
        <div className="wt-pop-actions">
          <Button size="sm" icon={<Icon name="changes" size={14} />} onClick={() => { setOpen(false); onOpenScm(); }}>{labels.openInSourceControl}</Button>
          {!running && (
            <Button size="sm" variant="ghost" icon={<Icon name="delete" size={14} />} disabled={busy} onClick={() => { setOpen(false); onCleanup(); }}>
              {labels.cleanupWorktree}
            </Button>
          )}
          {running && <p className="wt-pop-hint">{labels.worktreeBusyHint}</p>}
        </div>
      </AnchoredPopover>
    </div>
  );
}

export function WorkspaceTopbar({
  route,
  size,
  current,
  parent,
  runtime,
  running,
  busy,
  inspectorAvailable,
  inspectorOpen,
  labels,
  onSetRoute,
  onCleanupWorktree,
  onCancelAgent,
  onStartAgent,
  onOpenPalette,
  onToggleInspector,
}: Props) {
  const { compact, narrow } = size;
  const threadRoute = (route.kind === "thread" || route.kind === "review") && current;

  let title;
  if (route.kind === "context") {
    title = <h1>{labels.contextPage}</h1>;
  } else if (route.kind === "scm") {
    title = <h1>{labels.sourceControl}</h1>;
  } else if (threadRoute) {
    const threadTitle = sessionUI(current).title;
    title = (
      <>
        {parent && (
          <>
            <button type="button" className="toolbar-crumb no-drag" title={labels.backToParent} onClick={() => onSetRoute({ kind: "thread", sessionId: parent.id })}>
              {compact ? <Icon name="back" size={14} /> : <span>{sessionUI(parent).title}</span>}
            </button>
            {!compact && <Icon name="expand" size={13} className="toolbar-crumb-sep" />}
          </>
        )}
        <h1 title={threadTitle}>{threadTitle}</h1>
        {!compact && (
          <WorktreePill
            runtime={runtime}
            running={running}
            busy={busy}
            labels={labels}
            onOpenScm={() => onSetRoute({ kind: "scm", checkout: current.id })}
            onCleanup={onCleanupWorktree}
          />
        )}
      </>
    );
  } else {
    title = <h1 className="is-quiet">{labels.newTask}</h1>;
  }

  const startable = threadRoute && !running && (current.status === "created" || current.status === "interrupted");

  return (
    <div className="toolbar-main">
      <div className="toolbar-title">{title}</div>
      {threadRoute && (
        <div className="toolbar-actions no-drag">
          {running && (
            <Button size="sm" variant="secondary" icon={<Icon name="stop" size={13} />} disabled={busy} onClick={onCancelAgent} aria-keyshortcuts="Meta+.">
              {!narrow && labels.stop}
            </Button>
          )}
          {startable && (
            <Button size="sm" variant="secondary" icon={<Icon name="send" size={13} />} disabled={busy} onClick={onStartAgent}>
              {!narrow && (current.status === "interrupted" ? labels.resume : labels.start)}
            </Button>
          )}
          <SegmentedControl
            size="sm"
            ariaLabel={labels.threadView}
            value={route.kind === "review" ? "changes" : "conversation"}
            onChange={(view) => onSetRoute(view === "changes" ? { kind: "review", sessionId: current.id } : { kind: "thread", sessionId: current.id })}
            options={[
              { value: "conversation", title: labels.conversationView, label: narrow ? <Icon name="discussion" size={14} /> : labels.conversationView },
              { value: "changes", title: labels.changesView, label: narrow ? <Icon name="changes" size={14} /> : labels.changesView },
            ]}
          />
        </div>
      )}
      <div className="toolbar-actions no-drag">
        <IconButton icon={<Icon name="search" />} label={`${labels.commandPalette} ⌘K`} aria-keyshortcuts="Meta+K Control+K" onClick={onOpenPalette} />
        {inspectorAvailable && (
          <IconButton icon={<Icon name="panel" />} label={`${labels.inspector} ⌘I`} active={inspectorOpen} aria-keyshortcuts="Meta+I Control+I" onClick={onToggleInspector} />
        )}
      </div>
    </div>
  );
}
