import { useState, type FormEvent } from "react";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { maxNoteBytes, noteBytes } from "../../lib/note-text";
import type { TaskNote, TaskNoteEdit } from "../../types";
import { Icon } from "../primitives/Icon";
import { PathLabel } from "../primitives/PathLabel";
import { InspectorSection } from "./Section";

export type NotesLabels = Pick<
  AppCopy,
  | "taskNotes"
  | "taskNotesEmpty"
  | "taskNoteAdd"
  | "taskNotePlaceholder"
  | "taskNoteHint"
  | "taskNoteBytes"
  | "taskNoteByUser"
  | "taskNoteByAgent"
  | "taskNoteRemove"
>;

type Props = {
  // Core's order: oldest first.
  notes: TaskNote[];
  ready: boolean;
  busy: boolean;
  labels: NotesLabels;
  editNote: (edit: TaskNoteEdit) => Promise<boolean>;
};

// The thread's notes (ADR-0010 D1): facts the agent verified or the user decided, kept while older
// messages leave the window. The user adds and removes them; Core bounds and stores every edit.
export function NotesSection({ notes, ready, busy, labels, editNote }: Props) {
  const [draft, setDraft] = useState("");
  const draftBytes = noteBytes(draft);
  const newestFirst = [...notes].reverse();

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || draftBytes > maxNoteBytes) return;
    if (await editNote({ text })) setDraft("");
  };

  return (
    <InspectorSection
      title={labels.taskNotes}
      badge={notes.length > 0 && <span className="tp-pane-count">{notes.length}</span>}
    >
      {newestFirst.length === 0 ? (
        <p className="tp-pane-muted">{labels.taskNotesEmpty}</p>
      ) : (
        <ul className="ref-list note-list">
          {newestFirst.map((note) => (
            <li key={note.id} className={`ref-row note-row by-${note.by}`}>
              <Icon name={note.by === "user" ? "human" : "note"} size={14} className="ref-kind" />
              <div className="ref-main">
                <p className="note-text">{note.text}</p>
                <span className="ref-meta">{note.by === "user" ? labels.taskNoteByUser : labels.taskNoteByAgent}</span>
                {(note.cites ?? []).map((cite) => (
                  <PathLabel key={cite.path} path={cite.path} />
                ))}
              </div>
              <span className="ref-actions">
                <button
                  type="button"
                  className="link-btn is-danger"
                  disabled={busy}
                  onClick={() => void editNote({ id: note.id, remove: true })}
                >
                  {labels.taskNoteRemove}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form className="brief-edit note-add" onSubmit={add}>
        <textarea
          aria-label={labels.taskNoteAdd}
          placeholder={labels.taskNotePlaceholder}
          value={draft}
          rows={2}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!ready}
        />
        <div className="brief-edit-actions">
          <span className={draftBytes > maxNoteBytes ? "tp-pane-error" : "tp-pane-muted"}>
            {labels.taskNoteBytes.replace("{used}", String(draftBytes)).replace("{max}", String(maxNoteBytes))}
          </span>
          <button
            className="btn btn-sm btn-secondary"
            type="submit"
            disabled={busy || !ready || draftBytes === 0 || draftBytes > maxNoteBytes}
          >
            {labels.taskNoteAdd}
          </button>
        </div>
        <p className="tp-pane-muted">{labels.taskNoteHint}</p>
      </form>
    </InspectorSection>
  );
}
