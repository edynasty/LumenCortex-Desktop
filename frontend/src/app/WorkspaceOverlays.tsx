import { X } from "lucide-react";
import type { AppCopy } from "../lib/i18n/app-copy";
import { Button } from "../components/primitives/Button";
import { Dialog } from "../components/primitives/Dialog";

type Props = {
  cleanupOpen: boolean;
  busy: boolean;
  error: string;
  labels: AppCopy;
  onCleanupOpenChange: (open: boolean) => void;
  onCleanup: (force: boolean) => void;
  onClearError: () => void;
};

export function WorkspaceOverlays({
  cleanupOpen,
  busy,
  error,
  labels,
  onCleanupOpenChange,
  onCleanup,
  onClearError,
}: Props) {
  return (
    <>
      <Dialog
        open={cleanupOpen}
        title={labels.cleanupWorktreeTitle}
        description={labels.cleanupWorktreeBody}
        onOpenChange={onCleanupOpenChange}
        footer={
          <>
            <Button onClick={() => onCleanupOpenChange(false)}>{labels.cancel}</Button>
            <Button disabled={busy} onClick={() => onCleanup(false)}>
              {labels.cleanupWorktree}
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => onCleanup(true)}>
              {labels.forceCleanupWorktree}
            </Button>
          </>
        }
      />

      {error && (
        <div className="error-toast" role="alert">
          <strong>{labels.error}</strong>
          <span>{error}</span>
          <button onClick={onClearError} aria-label={labels.close}>
            <X size={14} strokeWidth={1.7} aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}
