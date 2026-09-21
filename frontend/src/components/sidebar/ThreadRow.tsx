import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Pin, PinOff } from "lucide-react";
import { useState } from "react";
import type { Session } from "../../types";
import { Button } from "../primitives/Button";
import { Dialog } from "../primitives/Dialog";
import { Popover } from "../primitives/Popover";

type Props = {
  session: Session;
  title: string;
  active: boolean;
  selected: boolean;
  statusLabel: string;
  labels: {
    rename: string;
    pin: string;
    unpin: string;
    archive: string;
    restore: string;
    save: string;
    cancel: string;
    menu: string;
  };
  pinned: boolean;
  archived: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onPinnedChange: (pinned: boolean) => void;
  onArchivedChange: (archived: boolean) => void;
};

function formatClock(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ThreadRow({
  session,
  title,
  active,
  selected,
  statusLabel,
  labels,
  pinned,
  archived,
  onSelect,
  onRename,
  onPinnedChange,
  onArchivedChange,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(title);

  function openRename() {
    setMenuOpen(false);
    setRenameValue(title);
    setRenameOpen(true);
  }

  return (
    <div className={`thread-item-row ${selected ? "selected" : ""}`}>
      <button type="button" className="thread-item thread-item-main" onClick={onSelect}>
        <span className={`thread-dot ${active ? "live" : session.status}`} />
        <span className="thread-copy">
          <strong>{title}</strong>
          <small>{statusLabel} · {formatClock(session.updatedAt)}</small>
        </span>
      </button>

      <Popover
        open={menuOpen}
        onOpenChange={setMenuOpen}
        ariaLabel={labels.menu}
        triggerClassName="thread-menu-trigger"
        contentClassName="thread-menu-popover"
        trigger={<MoreHorizontal size={14} strokeWidth={1.8} aria-hidden />}
      >
        <div className="thread-context-menu">
          <button type="button" onClick={openRename}>
            <Pencil size={13} strokeWidth={1.7} aria-hidden />
            <span>{labels.rename}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onPinnedChange(!pinned);
            }}
          >
            {pinned ? <PinOff size={13} strokeWidth={1.7} aria-hidden /> : <Pin size={13} strokeWidth={1.7} aria-hidden />}
            <span>{pinned ? labels.unpin : labels.pin}</span>
          </button>
          <button
            type="button"
            disabled={active && !archived}
            onClick={() => {
              setMenuOpen(false);
              onArchivedChange(!archived);
            }}
          >
            {archived
              ? <ArchiveRestore size={13} strokeWidth={1.7} aria-hidden />
              : <Archive size={13} strokeWidth={1.7} aria-hidden />}
            <span>{archived ? labels.restore : labels.archive}</span>
          </button>
        </div>
      </Popover>

      <Dialog
        open={renameOpen}
        title={labels.rename}
        onOpenChange={setRenameOpen}
        footer={
          <>
            <Button onClick={() => setRenameOpen(false)}>{labels.cancel}</Button>
            <Button
              variant="primary"
              disabled={!renameValue.trim()}
              onClick={() => {
                onRename(renameValue.trim());
                setRenameOpen(false);
              }}
            >
              {labels.save}
            </Button>
          </>
        }
      >
        <input
          className="thread-rename-input"
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && renameValue.trim()) {
              event.preventDefault();
              onRename(renameValue.trim());
              setRenameOpen(false);
            }
          }}
          autoFocus
        />
      </Dialog>
    </div>
  );
}
