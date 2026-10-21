/*
 * Context detail: provenance of one thread or file. A thread shows its resolution, its
 * references as Core recorded them (who, which state, note) and opens the real thread; a
 * file shows the threads that cite it and how. Nothing here invents data — every row comes
 * from a Task State reference or the session list the Desktop already holds.
 */
import type { ReactNode } from "react";
import type { Session, TaskNote, TaskStateInfo } from "../../types";
import { sessionUI } from "../../lib/session-ui";
import { formatRelative } from "../../lib/relative-time";
import { citingThreads, fileItem, type ContextGraph, type NoteFreshness } from "./context-page-types";
import type { AppCopy, Locale } from "../../lib/i18n/app-copy";
import { Button } from "../primitives/Button";
import { Icon } from "../primitives/Icon";
import { PathLabel } from "../primitives/PathLabel";
import { NoteSection } from "./ContextNotes";

function ReferenceRow({ labels, target, state, by, note, onSelectTarget }: {
  labels: AppCopy;
  target: ReactNode;
  state?: string;
  by?: string;
  note?: string;
  onSelectTarget?: () => void;
}) {
  const stateLabel = state === "included" ? labels.contextIncluded : state === "suggested" ? labels.contextSuggested : state === "excluded" ? labels.contextExcluded : state ?? "";
  const byLabel = by === "user" ? labels.contextByUser : by === "agent" ? labels.contextByAgent : by ?? "";
  return (
    <li className="cite-row">
      <Icon name={state === "included" ? "checkmark" : state === "excluded" ? "close" : "stale"} size={13} className={state === "excluded" ? "is-excluded" : ""} />
      <span className="cite-target">
        {onSelectTarget ? <button type="button" className="link-btn" onClick={onSelectTarget}>{target}</button> : target}
      </span>
      <span className={`badge ${state === "included" ? "tone-ok" : state === "excluded" ? "tone-bad" : "tone-warn"}`}>{stateLabel}</span>
      {byLabel && <span className="cite-by">{byLabel}</span>}
      {note && <span className="cite-note" title={note}>{note}</span>}
    </li>
  );
}

/** One thread: identity, resolution, its references, its notes and the action to open it. */
export function ThreadDetail({ session, state, notes, freshness, threadTitle, labels, locale, now, onOpenThread, onSelectItem, onForgetNote }: {
  session: Session;
  /** Title of a referenced thread the page holds; undefined when it is outside the bound. */
  threadTitle: (sessionId: string) => string | undefined;
  state?: TaskStateInfo;
  notes: TaskNote[];
  /** Core's read_thread freshness for this Task State version; undefined when unknown. */
  freshness?: NoteFreshness;
  labels: AppCopy;
  locale: Locale;
  now: number;
  onOpenThread: (sessionId: string) => void;
  onSelectItem: (id: string) => void;
  onForgetNote: (noteId: string) => Promise<void>;
}) {
  const resolution = state?.state.resolution.state;
  const references = state?.state.references ?? [];
  return (
    <article className="context-article">
      <header className="context-article-head">
        <Icon name={resolution === "done" ? "done" : resolution === "dropped" ? "dropped" : "open"} size={18} />
        <h2>{sessionUI(session).title}</h2>
      </header>
      <p className="context-article-meta">
        {resolution && (
          <span className={`badge ${resolution === "done" ? "tone-ok" : resolution === "dropped" ? "tone-bad" : "tone-accent"}`}>
            {resolution === "done" ? labels.taskResolutionDone : resolution === "dropped" ? labels.taskResolutionDropped : labels.taskResolutionOpen}
          </span>
        )}
        <span className="mono">{session.id}</span>
        <span>{formatRelative(session.updatedAt, now, locale)}</span>
      </p>
      {state?.state.brief && <p className="context-article-body">{state.state.brief}</p>}
      <section className="context-article-section">
        <h4>{labels.contextReferences}</h4>
        {references.length === 0 ? (
          <p className="context-article-muted">{labels.contextNoReferences}</p>
        ) : (
          <ul className="cite-list">
            {references.map((ref) => (
              <ReferenceRow
                key={ref.id}
                labels={labels}
                target={ref.kind === "path"
                  ? <PathLabel path={ref.target} />
                  : threadTitle(ref.target) ?? <span className="mono">{ref.target}</span>}
                state={ref.state}
                by={ref.by}
                note={ref.note}
                onSelectTarget={ref.kind === "path"
                  ? () => onSelectItem(fileItem(ref.target))
                  : threadTitle(ref.target) !== undefined ? () => onSelectItem(ref.target) : undefined}
              />
            ))}
          </ul>
        )}
      </section>
      <NoteSection
        notes={notes}
        freshness={freshness}
        labels={labels}
        onSelectItem={onSelectItem}
        onForgetNote={onForgetNote}
      />
      <div className="context-actions">
        <Button variant="primary" size="sm" onClick={() => onOpenThread(session.id)}>{labels.contextOpenThread}</Button>
      </div>
    </article>
  );
}

/** One file: not a stored item — the detail is the threads that cite it, and how. */
export function FileDetail({ path, graph, labels, sessions, onSelectItem }: {
  path: string;
  graph: ContextGraph;
  labels: AppCopy;
  sessions: Session[];
  onSelectItem: (id: string) => void;
}) {
  const citing = citingThreads(graph, fileItem(path));
  const byId = new Map(sessions.map((session) => [session.id, session]));
  return (
    <article className="context-article">
      <header className="context-article-head context-file-title">
        <Icon name="file" size={18} />
        <h2><PathLabel path={path} /></h2>
      </header>
      <section className="context-article-section">
        <h4>{labels.contextCitedBy}</h4>
        {citing.length === 0 ? (
          <p className="context-article-muted">{labels.contextNotCited}</p>
        ) : (
          <ul className="cite-list">
            {citing.map((edge) => {
              const session = byId.get(edge.from);
              return (
                <ReferenceRow
                  key={edge.id}
                  labels={labels}
                  target={
                    <button type="button" className="link-btn" onClick={() => onSelectItem(edge.from)}>
                      {session ? sessionUI(session).title : edge.from}
                    </button>
                  }
                  state={edge.kind === "includes" ? "included" : "suggested"}
                  by={edge.by}
                  note={edge.note}
                />
              );
            })}
          </ul>
        )}
      </section>
      <p className="context-article-muted">{labels.contextFileHint}</p>
    </article>
  );
}
