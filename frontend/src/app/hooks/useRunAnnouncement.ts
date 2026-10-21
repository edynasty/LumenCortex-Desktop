import { useEffect, useRef, useState } from "react";
import type { SidebarGroup } from "../../components/sidebar/Sidebar";
import { runAnnouncement, runSnapshot, type RunSnapshot } from "../../lib/run-announcement";

const CLEAR_AFTER_MS = 4000;

/**
 * Text for the shell's live region. Each announcement is its own occurrence: the text is identical
 * when two threads with the same title finish together, and a live region only speaks when its DOM
 * text changes, so every other occurrence carries an invisible zero-width space. The clear timer
 * restarts per occurrence.
 */
export function useRunAnnouncement(groups: SidebarGroup[]): string {
  const [spoken, setSpoken] = useState({ seq: 0, text: "" });
  const previous = useRef<RunSnapshot | undefined>(undefined);

  useEffect(() => {
    const next = runSnapshot(groups);
    const text = runAnnouncement(previous.current, next);
    previous.current = next;
    if (text) setSpoken((current) => ({ seq: current.seq + 1, text }));
  }, [groups]);

  useEffect(() => {
    if (!spoken.text) return;
    const timer = window.setTimeout(() => setSpoken((current) => (current.seq === spoken.seq ? { seq: current.seq, text: "" } : current)), CLEAR_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [spoken.seq, spoken.text]);

  return spoken.text && spoken.seq % 2 === 0 ? `${spoken.text}\u200b` : spoken.text;
}
