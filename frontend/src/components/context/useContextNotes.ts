/*
 * Notes for the Context page: one row per Task State note across the loaded threads, and the
 * freshness Core's read_thread reports for their cited files (ADR-0010 D4). Freshness is fetched
 * lazily — for the selected thread, and for every loaded thread with cited notes while the notes
 * filter is active — and cached per Task State version, so an edit never shows a stale cache.
 * Files change without a Task State edit, so the cache is dropped when the page is left and every
 * visit reads freshness again. A failed read leaves freshness unknown (no marker) and never blocks
 * the list.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session, TaskStateInfo } from "../../types";
import { bridge } from "../../lib/bridge";
import { sessionUI } from "../../lib/session-ui";
import type { ContextFilter, ContextNoteRow, NoteFreshness } from "./context-page-types";

export function useContextNotes(input: {
  enabled: boolean;
  filter: ContextFilter;
  states: Record<string, TaskStateInfo>;
  threads: Session[];
  selectedThread: string | null;
}): { freshnessFor: (sessionId: string) => NoteFreshness | undefined; rows: ContextNoteRow[] } {
  const { enabled, filter, states, threads, selectedThread } = input;
  const [freshness, setFreshness] = useState<Record<string, NoteFreshness>>({});
  const cache = useRef(freshness);

  // Leaving the page drops the cache: freshness is a property of the files, not of Task State.
  useEffect(() => {
    if (enabled) return;
    cache.current = {};
    setFreshness({});
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const wanted = new Map<string, number>();
    const consider = (id: string | null) => {
      if (!id || wanted.has(id)) return;
      const info = states[id];
      if (!(info?.state.notes ?? []).some((note) => (note.cites?.length ?? 0) > 0)) return;
      if (cache.current[id]?.version === info!.version) return;
      wanted.set(id, info!.version);
    };
    if (filter === "notes") {
      for (const id of Object.keys(states)) consider(id);
    }
    consider(selectedThread);
    if (wanted.size === 0) return;

    let cancelled = false;
    Promise.all(
      [...wanted].map(([id, version]) =>
        bridge.threadNotes(id).then(
          (notes) => ({ id, version, notes }),
          () => null,
        ),
      ),
    ).then((replies) => {
      if (cancelled) return;
      const next = { ...cache.current };
      for (const reply of replies) {
        if (!reply) continue;
        // A reply for an older Task State version never replaces a newer cache entry.
        if ((next[reply.id]?.version ?? -1) > reply.version) continue;
        next[reply.id] = { version: reply.version, notes: Object.fromEntries(reply.notes.map((note) => [note.id, note])) };
      }
      cache.current = next;
      setFreshness(next);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, filter, states, selectedThread]);

  // Only freshness read for the Task State version on screen is used; a stale cache never shows.
  const freshnessFor = (sessionId: string) => {
    const info = states[sessionId];
    const cached = freshness[sessionId];
    return info && cached?.version === info.version ? cached : undefined;
  };

  const rows = useMemo(() => {
    const out: ContextNoteRow[] = [];
    for (const session of threads) {
      const info = states[session.id];
      const fresh = info && freshness[session.id]?.version === info.version ? freshness[session.id] : undefined;
      const title = sessionUI(session).title;
      for (const note of info?.state.notes ?? []) {
        out.push({
          id: `${session.id}:${note.id}`,
          sessionId: session.id,
          title,
          text: note.text,
          by: note.by,
          at: note.at,
          cites: note.cites?.length ?? 0,
          stale: fresh?.notes[note.id]?.stale === true,
        });
      }
    }
    return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id.localeCompare(b.id)));
  }, [threads, states, freshness]);

  return { freshnessFor, rows };
}
