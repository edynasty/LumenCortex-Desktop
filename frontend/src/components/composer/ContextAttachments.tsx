import { FilePlus2, FolderPlus, Paperclip, X } from "lucide-react";
import { useState } from "react";
import { Popover } from "../primitives/Popover";

type Props = {
  paths: string[];
  disabled?: boolean;
  labels: {
    context: string;
    files: string;
    folder: string;
    remove: string;
  };
  onPickFiles: () => void;
  onPickFolder: () => void;
  onRemove: (path: string) => void;
};

export function ContextAttachments({
  paths,
  disabled = false,
  labels,
  onPickFiles,
  onPickFolder,
  onRemove,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="composer-context-attachments">
      <Popover
        open={open}
        onOpenChange={setOpen}
        ariaLabel={labels.context}
        disabled={disabled}
        triggerClassName="composer-context-attach-trigger"
        contentClassName="composer-context-attach-popover"
        trigger={
          <>
            <Paperclip size={13} strokeWidth={1.7} aria-hidden />
            <span>{labels.context}</span>
            {paths.length > 0 && <small>{paths.length}</small>}
          </>
        }
      >
        <div className="composer-context-attach-menu">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onPickFiles();
            }}
          >
            <FilePlus2 size={14} strokeWidth={1.7} aria-hidden />
            <span>{labels.files}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onPickFolder();
            }}
          >
            <FolderPlus size={14} strokeWidth={1.7} aria-hidden />
            <span>{labels.folder}</span>
          </button>
        </div>
      </Popover>

      {paths.length > 0 && (
        <div className="composer-context-chips" aria-label={labels.context}>
          {paths.map((path) => (
            <span className="composer-context-chip" key={path} title={path}>
              <code>{path}</code>
              <button
                type="button"
                aria-label={`${labels.remove}: ${path}`}
                onClick={() => onRemove(path)}
              >
                <X size={11} strokeWidth={1.8} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
