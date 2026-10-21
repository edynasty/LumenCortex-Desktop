import { useState } from "react";
import { Icon } from "../primitives/Icon";
import { PathLabel } from "../primitives/PathLabel";
import { AnchoredPopover } from "../primitives/AnchoredPopover";

type Labels = {
  context: string;
  files: string;
  folder: string;
  remove: string;
};

/**
 * The composer's attach control: a chip that opens the pick menu (files or folder). The
 * picked paths render as chips above the input (ContextAttachments).
 */
export function ContextAttachTrigger({
  disabled = false,
  labels,
  count,
  onPickFiles,
  onPickFolder,
}: {
  disabled?: boolean;
  labels: Labels;
  count: number;
  onPickFiles: () => void;
  onPickFolder: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="popover-anchor">
      <button
        type="button"
        className={`chip chip-icon ${count > 0 ? "is-static" : ""}`}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={labels.context}
        title={labels.context}
      >
        <Icon name="attach" size={15} />
        {count > 0 && <span className="count-badge">{count}</span>}
      </button>
      <AnchoredPopover open={open} onClose={() => setOpen(false)} placement="above-start" label={labels.context} className="menu">
        <div role="menu" aria-label={labels.context}>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              onPickFiles();
            }}
          >
            <Icon name="addFile" size={15} />
            <span className="menu-item-body"><span>{labels.files}</span></span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              onPickFolder();
            }}
          >
            <Icon name="addFolder" size={15} />
            <span className="menu-item-body"><span>{labels.folder}</span></span>
          </button>
        </div>
      </AnchoredPopover>
    </span>
  );
}

/** Picked context paths as removable chips above the composer input. */
export function ContextAttachments({ paths, labels, onRemove }: {
  paths: string[];
  labels: Pick<Labels, "context" | "remove">;
  onRemove: (path: string) => void;
}) {
  if (!paths.length) return null;
  return (
    <div className="composer-context" aria-label={labels.context}>
      {paths.map((path) => (
        <span className="context-chip" key={path} title={path}>
          <Icon name="file" size={12} />
          <PathLabel path={path} />
          <button type="button" aria-label={`${labels.remove}: ${path}`} onClick={() => onRemove(path)}>
            <Icon name="close" size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}
