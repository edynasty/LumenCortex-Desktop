/* Thread row: title + time on line one, durable status + where it runs on line two. */
import { useState } from "react";
import type { Session, SessionRuntime } from "../../types";
import { LumenIndicator } from "../brand/A1Mark";
import { AnchoredPopover } from "../primitives/AnchoredPopover";
import { Button } from "../primitives/Button";
import { Dialog } from "../primitives/Dialog";
import { Icon } from "../primitives/Icon";
import type { IconName } from "../primitives/icons";

type Props = {
  session: Session;
  runtime: SessionRuntime;
  title: string;
  active: boolean;
  selected: boolean;
  statusLabel: string;
  attentionTone?: "warning" | "danger";
  /** Relative update time, formatted by the caller for the current locale. */
  time: string;
  labels: {
    rename: string;
    pin: string;
    unpin: string;
    archive: string;
    restore: string;
    delete: string;
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
  onDelete: () => void;
};

// One glyph per durable status; "running" here means running in another process.
const statusGlyph: Record<string, { icon: IconName; tone: string }> = {
  waiting_gate: { icon: "gate", tone: "is-gate" },
  failed: { icon: "failed", tone: "is-failed" },
  interrupted: { icon: "interrupted", tone: "is-interrupted" },
  completed: { icon: "done", tone: "is-ended" },
  running: { icon: "subagent", tone: "is-elsewhere" },
};

export function ThreadRow({
  session,
  runtime,
  title,
  active,
  selected,
  statusLabel,
  attentionTone,
  time,
  labels,
  pinned,
  archived,
  onSelect,
  onRename,
  onPinnedChange,
  onArchivedChange,
  onDelete,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(title);
  const glyph = statusGlyph[session.status] ?? { icon: "idle" as const, tone: "is-idle" };
  const statusTone = active ? "hint-running" : attentionTone === "warning" ? "hint-gate" : attentionTone === "danger" ? "hint-failed" : "is-quiet";

  const rename = () => {
    if (!renameValue.trim()) return;
    onRename(renameValue.trim());
    setRenameOpen(false);
  };

  return (
    <div className={`thread-row-wrap popover-anchor ${menuOpen ? "is-menu-open" : ""}`}>
      <button
        type="button"
        className={`thread-row ${selected ? "is-selected" : ""}`}
        aria-current={selected ? "page" : undefined}
        aria-label={`${title} · ${statusLabel}`}
        title={title}
        onClick={onSelect}
      >
        <span className="thread-row-glyph">
          {active ? <LumenIndicator size={14} /> : <Icon name={glyph.icon} size={14} className={`status-glyph ${glyph.tone}`} />}
        </span>
        <span className="thread-row-title">{title}</span>
        <span className="thread-row-time">{time}</span>
        <span className="thread-row-meta">
          <span className={`thread-row-status ${statusTone}`}>{statusLabel}</span>
          {runtime.kind === "worktree" && (
            <span className="thread-row-runtime"><Icon name="worktree" size={11} /><span>{runtime.branch || runtime.path}</span></span>
          )}
        </span>
      </button>

      <button
        type="button"
        className="icon-btn is-sm thread-row-menu"
        aria-label={labels.menu}
        title={labels.menu}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <Icon name="more" size={14} />
      </button>
      <AnchoredPopover open={menuOpen} onClose={() => setMenuOpen(false)} placement="below-end" label={labels.menu} className="menu thread-row-popover">
        <button type="button" className="menu-item" onClick={() => { setMenuOpen(false); setRenameValue(title); setRenameOpen(true); }}>
          <Icon name="edit" size={14} /><span className="menu-item-body"><span>{labels.rename}</span></span>
        </button>
        <button type="button" className="menu-item" onClick={() => { setMenuOpen(false); onPinnedChange(!pinned); }}>
          <Icon name="pin" size={14} /><span className="menu-item-body"><span>{pinned ? labels.unpin : labels.pin}</span></span>
        </button>
        <button type="button" className="menu-item" disabled={active && !archived} onClick={() => { setMenuOpen(false); onArchivedChange(!archived); }}>
          <Icon name="archive" size={14} /><span className="menu-item-body"><span>{archived ? labels.restore : labels.archive}</span></span>
        </button>
        <div className="menu-sep" />
        <button type="button" className="menu-item is-danger" disabled={active} onClick={() => { setMenuOpen(false); onDelete(); }}>
          <Icon name="delete" size={14} /><span className="menu-item-body"><span>{labels.delete}</span></span>
        </button>
      </AnchoredPopover>

      <Dialog
        open={renameOpen}
        title={labels.rename}
        onOpenChange={setRenameOpen}
        footer={
          <>
            <Button onClick={() => setRenameOpen(false)}>{labels.cancel}</Button>
            <Button variant="primary" disabled={!renameValue.trim()} onClick={rename}>{labels.save}</Button>
          </>
        }
      >
        <input
          className="input"
          value={renameValue}
          aria-label={labels.rename}
          onChange={(event) => setRenameValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            rename();
          }}
          autoFocus
        />
      </Dialog>
    </div>
  );
}
