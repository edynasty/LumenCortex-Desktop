/*
 * Notes in the Context page (ADR-0010): the list lens's rows across threads, and the section in a
 * thread's detail. Every row comes from a Task State note; a stale marker comes only from Core's
 * read_thread freshness, so an unknown read shows no marker.
 */
import { useState } from "react";
import type { TaskNote } from "../../types";
import type { AppCopy } from "../../lib/i18n/app-copy";
import { Icon } from "../primitives/Icon";
import { PathLabel } from "../primitives/PathLabel";
import { fileItem, type ContextNoteRow, type NoteFreshness } from "./context-page-types";

/** One list row per note across the loaded threads; clicking a row opens its source thread. */
export function ContextNoteRows({ rows, selected, labels, onSelect }: {
  rows: ContextNoteRow[];
  selected: string | null;
  labels: AppCopy;
  onSelect: (sessionId: string) => void;
}) {
  return (
    <>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          role="listitem"
          className={`context-row ${selected === row.sessionId ? "is-selected" : ""}`}
          aria-current={selected === row.sessionId ? "true" : undefined}
          onClick={() => onSelect(row.sessionId)}
        >
          <Icon name={row.by === "user" ? "human" : "note"} size={15} />
          <span className="context-row-body">
            <span className="context-row-title" title={row.text}>{row.text}</span>
            <span className="context-row-meta">
              <span className="context-row-kind">{row.by === "user" ? labels.taskNoteByUser : labels.taskNoteByAgent}</span>
              <span className="context-row-kind">{row.title}</span>
              {row.cites > 0 && <span className="context-row-kind">{labels.contextNoteCites(row.cites)}</span>}
              {row.stale && <span className="badge tone-warn">{labels.contextNoteStale}</span>}
            </span>
          </span>
        </button>
      ))}
    </>
  );
}

/**
 * A thread's notes in its detail: author, text, the cited paths (clicking one selects that file)
 * and Forget, which removes the note through Core as the user.
 */
export function NoteSection({ notes, freshness, labels, onSelectItem, onForgetNote }: {
  notes: TaskNote[];
  freshness?: NoteFreshness;
  labels: AppCopy;
  onSelectItem: (id: string) => void;
  onForgetNote: (noteId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const newestFirst = [...notes].reverse();

  const forget = async (id: string) => {
    setBusy(id);
    try {
      await onForgetNote(id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="context-article-section">
      <h4>{labels.taskNotes}</h4>
      {newestFirst.length === 0 ? (
        <p className="context-article-muted">{labels.contextNoNotes}</p>
      ) : (
        <ul className="cite-list">
          {newestFirst.map((note) => {
            const fresh = freshness?.notes[note.id];
            return (
              <li key={note.id} className="context-note">
                <div className="context-note-head">
                  <span className="cite-by">{note.by === "user" ? labels.taskNoteByUser : labels.taskNoteByAgent}</span>
                  {fresh?.stale && <span className="badge tone-warn">{labels.contextNoteStale}</span>}
                  <button
                    type="button"
                    className="link-btn is-danger"
                    disabled={busy === note.id}
                    onClick={() => void forget(note.id)}
                  >
                    {labels.contextNoteForget}
                  </button>
                </div>
                <p className="context-note-text">{note.text}</p>
                {(note.cites ?? []).length > 0 && (
                  <ul className="cite-list">
                    {(note.cites ?? []).map((cite) => {
                      const stale = fresh?.cites?.some((view) => view.path === cite.path && view.stale === true) === true;
                      return (
                        <li key={cite.path} className="cite-row">
                          <Icon name={stale ? "stale" : "file"} size={13} className={stale ? "is-excluded" : undefined} />
                          <span className="cite-target">
                            <button type="button" className="link-btn" onClick={() => onSelectItem(fileItem(cite.path))}>
                              <PathLabel path={cite.path} />
                            </button>
                          </span>
                          {stale && <span className="badge tone-warn">{labels.contextNoteCiteStale}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
