import { useState } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { clipNote, maxNoteBytes, noteBytes } from "../../lib/note-text";
import { Icon } from "../primitives/Icon";

export type RememberLabels = Pick<
  AppCopy,
  "remember" | "remembered" | "rememberTitle" | "rememberSave" | "rememberCancel" | "rememberClipped" | "taskNoteBytes"
>;

// Saves the text as a user note of this thread (ADR-0010: "Remember" is a user note). It returns ""
// on success, else the error to show.
export type RememberNote = (text: string) => Promise<string>;

export function RememberButton({ saved, labels, onOpen }: { saved: boolean; labels: RememberLabels; onOpen: () => void }) {
  const label = saved ? labels.remembered : labels.rememberTitle;
  return (
    <button type="button" className="msg-action" aria-label={label} title={label} onClick={onOpen}>
      <Icon name={saved ? "checkmark" : "note"} size={12} />
    </button>
  );
}

type EditorProps = {
  text: string;
  labels: RememberLabels;
  onRemember: RememberNote;
  // saved: whether the note was stored.
  onClose: (saved: boolean) => void;
};

// RememberEditor is seeded with the message cut to Core's note bound, so the user keeps the part
// worth remembering before saving it.
export function RememberEditor({ text, labels, onRemember, onClose }: EditorProps) {
  const [seed] = useState(() => clipNote(text));
  const [draft, setDraft] = useState(seed.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bytes = noteBytes(draft);

  const save = async () => {
    setBusy(true);
    const failure = await onRemember(draft.trim());
    setBusy(false);
    if (failure) setError(failure);
    else onClose(true);
  };

  return (
    <div className="brief-edit remember-edit" role="group" aria-label={labels.rememberTitle}>
      <textarea aria-label={labels.remember} value={draft} rows={3} onChange={(event) => setDraft(event.target.value)} autoFocus />
      {seed.clipped && <p className="tp-pane-muted">{labels.rememberClipped.replace("{max}", String(maxNoteBytes))}</p>}
      {error && <p className="tp-pane-error" role="alert">{error}</p>}
      <div className="brief-edit-actions">
        <span className={bytes > maxNoteBytes ? "tp-pane-error" : "tp-pane-muted"}>
          {labels.taskNoteBytes.replace("{used}", String(bytes)).replace("{max}", String(maxNoteBytes))}
        </span>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => onClose(false)}>
          {labels.rememberCancel}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={busy || bytes === 0 || bytes > maxNoteBytes}
          onClick={() => void save()}
        >
          {labels.rememberSave}
        </button>
      </div>
    </div>
  );
}
