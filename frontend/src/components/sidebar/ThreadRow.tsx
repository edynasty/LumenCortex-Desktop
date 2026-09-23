import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Pin, PinOff } from "lucide-react";
import { useState } from "react";
import type { Session, SessionRuntime } from "../../types";
import { Button } from "../primitives/Button";
import { Dialog } from "../primitives/Dialog";
import { Popover } from "../primitives/Popover";
import { RuntimeIdentity } from "../runtime/RuntimeIdentity";

type Props = {
  session: Session;
  runtime: SessionRuntime;
  title: string;
  active: boolean;
  selected: boolean;
  statusLabel: string;
  attentionTone?: "warning" | "danger";
  labels: {
    rename: string;
    pin: string;
    unpin: string;
    archive: string;
    restore: string;
    save: string;
    cancel: string;
    menu: string;
    localRuntime: string;
    worktreeRuntime: string;
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
  runtime,
  title,
  active,
  selected,
  statusLabel,
  attentionTone,
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
    <div className={`thread-item-row ${selected ? "selected" : ""} ${attentionTone ? `attention-${attentionTone}` : ""}`}>
      <button
        type="button"
        className="thread-item thread-item-main"
        onClick={onSelect}
        aria-label={`${title} · ${statusLabel}`}
      >
        <span className={`thread-dot ${active ? "live" : attentionTone ? `attention-${attentionTone}` : session.status}`} />
        <span className="thread-copy">
          <strong>{title}</strong>
          <small>
            {statusLabel} · {formatClock(session.updatedAt)}
            {" · "}
            <RuntimeIdentity
              runtime={runtime}
              localLabel={labels.localRuntime}
              worktreeLabel={labels.worktreeRuntime}
              compact
            />
          </small>
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
