import { useRef } from "react";
import { X } from "lucide-react";
import type { AppCopy } from "../lib/i18n/app-copy";
import { usePresence } from "../components/primitives/usePresence";
import { WorktreeCleanupDialog, type WorktreeCleanupTarget } from "../components/worktree/WorktreeCleanupDialog";

type Props = {
  worktreeCleanupTarget: WorktreeCleanupTarget | null;
  error: string;
  labels: AppCopy;
  onWorktreeCleanupClose: () => void;
  onWorktreeCleanupCompleted: (deletedSessionIds: string[]) => void;
  errorActionLabel?: string;
  onErrorAction?: () => void;
  onClearError: () => void;
};

export function WorkspaceOverlays({
  worktreeCleanupTarget,
  error,
  labels,
  onWorktreeCleanupClose,
  onWorktreeCleanupCompleted,
  errorActionLabel,
  onErrorAction,
  onClearError,
}: Props) {
  // The toast keeps its last message while it plays its exit.
  const { present, state } = usePresence(Boolean(error));
  const last = useRef({ error, errorActionLabel, onErrorAction });
  if (error) last.current = { error, errorActionLabel, onErrorAction };
  const shown = error ? { error, errorActionLabel, onErrorAction } : last.current;
  return (
    <>
      <WorktreeCleanupDialog
        target={worktreeCleanupTarget}
        labels={labels}
        onClose={onWorktreeCleanupClose}
        onCompleted={onWorktreeCleanupCompleted}
      />

      {present && (
        <div className="error-toast" role="alert" data-state={state} {...(error ? {} : { inert: "" })}>
          <strong>{labels.error}</strong>
          <div className="error-toast-copy">
            <span>{shown.error}</span>
            {shown.errorActionLabel && shown.onErrorAction && (
              <button className="error-toast-action" type="button" onClick={shown.onErrorAction}>
                {shown.errorActionLabel}
              </button>
            )}
          </div>
          <button className="error-toast-close" type="button" onClick={onClearError} aria-label={labels.close}>
            <X size={14} strokeWidth={1.7} aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}
