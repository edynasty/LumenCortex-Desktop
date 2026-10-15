import { X } from "lucide-react";
import type { AppCopy } from "../lib/i18n/app-copy";
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
  return (
    <>
      <WorktreeCleanupDialog
        target={worktreeCleanupTarget}
        labels={labels}
        onClose={onWorktreeCleanupClose}
        onCompleted={onWorktreeCleanupCompleted}
      />

      {error && (
        <div className="error-toast" role="alert">
          <strong>{labels.error}</strong>
          <div className="error-toast-copy">
            <span>{error}</span>
            {errorActionLabel && onErrorAction && (
              <button className="error-toast-action" type="button" onClick={onErrorAction}>
                {errorActionLabel}
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
